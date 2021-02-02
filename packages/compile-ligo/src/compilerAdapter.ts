import { CompilerResult, Source, CompiledContract } from "@truffle/compile-common";

const compiler = {
  name: "ligo",
  version: "next"
};

const buildSource = (resultEntry: any): Source => {
  return {
    sourcePath: resultEntry.sourcePath,
    contents: resultEntry.source,
    language: compiler.name
  };
};

const buildCompiledContract = (resultEntry: any): CompiledContract => {
  return {
    contractName: resultEntry.contractName,
    sourcePath: resultEntry.sourcePath,
    source: resultEntry.source,
    sourceMap: "",
    deployedSourceMap: "",
    legacyAST: {},
    ast: {},
    abi: null,
    metadata: "",
    bytecode: null,
    deployedBytecode: null,
    compiler,
    devdoc: {},
    userdoc: {},
    immutableReferences: null,
    generatedSources: {},
    deployedGeneratedSources: {}
  };
};

const compilerAdapter =  (ligoCompilerResult: {
  result: any;
  paths: string[];
  compiler: {
      name: string;
      version: string;
  };
}): CompilerResult => {
  return {
    compilations: [
      {
        sourceIndexes: ligoCompilerResult.paths,
        compiler,
        sources: Object.values(ligoCompilerResult.result).map(buildSource),
        contracts: Object.values(ligoCompilerResult.result).map(buildCompiledContract)
      }
    ]
  };
};

export { compilerAdapter };