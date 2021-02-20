const { Compile } = require("@truffle/compile-solidity");
import type TruffleConfig from "@truffle/config";
import type { WorkflowCompileResult } from "@truffle/compile-common";
import Web3 from "web3";
import * as Common from "@truffle/compile-common";
import {
  Fetcher,
  FetcherConstructor,
  InvalidNetworkError,
  default as Fetchers
} from "@truffle/source-fetcher";
import type { Project } from "@truffle/db";

export interface FetchExternalOptions {
  config: TruffleConfig;
  project: Project.ConnectedProject;
  address: string;
}

export async function fetchExternal({
  config,
  project,
  address
}: FetchExternalOptions): Promise<void> {
  const { contractName, result } = await fetchAndCompile({ config, address });

  const { contracts } = await project.loadCompile({ result });

  const contract = await findContract({
    config,
    contracts,
    contractName,
    address
  });

  await project.assignNames({
    assignments: {
      contracts: [contract.db.contract]
    }
  });

  const { network } = await project.loadMigrate({
    network: { name: config.network },
    artifacts: [
      {
        ...Common.Shims.NewToLegacy.forContract(contract),
        networks: {
          [config.network_id]: {
            address
          }
        }
      }
    ]
  });

  await project.assignNames({
    assignments: {
      networks: [network]
    }
  });
}

/**
 * Accepts a TruffleConfig and returns a priority-sorted list of fetchers based
 * on provided configuration and whether available fetchers support the current
 * blockchain network.
 */
export async function forTruffleConfig(options: {
  config: TruffleConfig;
}): Promise<Fetcher[]> {
  const { config } = options;

  // respect optional `config.sourceFetchers`, used to specify explicit
  // ordering for which fetchers to use.
  const constructors: FetcherConstructor[] = config.sourceFetchers
    ? config.sourceFetchers.map(sourceFetcherName => {
        const Fetcher = Fetchers.find(
          Fetcher => Fetcher.fetcherName === sourceFetcherName
        );

        if (!Fetcher) {
          throw new Error(
            `Unknown external source servce ${sourceFetcherName}.`
          );
        }
        return Fetcher;
      })
    : Fetchers;

  // exclude fetchers that don't support connected network
  const networkId = parseInt(config.network_id);
  const fetchers = (
    await Promise.all(
      constructors.map(async (Fetcher: FetcherConstructor) => {
        const options = config[Fetcher.fetcherName];

        try {
          return await Fetcher.forNetworkId(networkId, options);
        } catch (error) {
          if (!(error instanceof InvalidNetworkError)) {
            throw error;
          }
        }
      })
    )
  ).filter((fetcher): fetcher is Fetcher => !!fetcher);

  return fetchers;
}

async function fetchAndCompile(options: {
  config: TruffleConfig;
  address: string;
}): Promise<{
  contractName: string;
  result: WorkflowCompileResult;
}> {
  const { config, address } = options;
  const fetchers = await forTruffleConfig({ config });

  for (const fetcher of fetchers) {
    //now comes all the hard parts!
    //get our sources
    let result;
    try {
      result = await fetcher.fetchSourcesForAddress(address);
    } catch (error) {
      continue;
    }
    if (result === null) {
      //null means they don't have that address
      continue;
    }
    //if we do have it, extract sources & options
    const { contractName, sources, options } = result;
    if (options.language !== "Solidity") {
      //if it's not Solidity, bail out now
      //break out of the fetcher loop, since *no* fetcher will work here
      break;
    }

    //compile the sources
    const externalConfig = config
      .with({
        compilers: {
          solc: options
        },
        quiet: true
      })
      .merge({
        //turn on docker if the original config has docker
        compilers: {
          solc: {
            docker: ((config.compilers || {}).solc || {}).docker
          }
        }
      });

    return {
      contractName,
      result: await Compile.sources({
        options: externalConfig,
        sources
      })
    };
  }

  throw new Error("Unable to find");
}

async function findContract<Contract extends Common.CompiledContract>(options: {
  contractName: string | undefined;
  contracts: Contract[];
  address: string;
  config: TruffleConfig;
}): Promise<Contract> {
  const { contractName, contracts, address, config } = options;

  // simple case; we get the contract name and it matches exactly one contract
  if (contractName) {
    const matching = contracts.filter(
      contract => contract.contractName === contractName
    );

    if (matching.length === 1) {
      return matching[0];
    }
  }

  throw new Error(`Contract ${contractName} not loaded into @truffle/db.`);
}
