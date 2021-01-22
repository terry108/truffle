/* eslint-disable @typescript-eslint/no-unused-vars */
import { Compiler, CompilerResult, Profiler } from "@truffle/compile-common";
import * as path from "path";

import debugModule from "debug";
const debug = debugModule("compile-ligo");

import { shouldIncludePath } from "./profiler/shouldIncludePath";
import { checkLigo, compileLigo } from "./compiler";

const LIGO_PATTERN = "**/*.{ligo,mligo,religo}";

const Compile: Compiler = {
  async all(options: object): Promise<CompilerResult> {
    return {
      compilations: []
    };
  },

  async necessary(options: any): Promise<CompilerResult> {
    debug('CALL LIGO: necessary');
    options.logger = options.logger || console;

    // const fileSearchPattern = path.join(
    //   options.contracts_directory,
    //   LIGO_PATTERN
    // );

    // Profiler for updated files
    const profiler = new Profiler({}); // TODO BGC Make them optional
    const paths = await profiler.updated(options);
    if (paths.length === 0) {
      return { compilations: [] };
    }

    // Profiler for LIGO files
    const newProfiler = new Profiler({
      shouldIncludePath
    } as any);

    // invoke profiler
    const newProfilerResult = await newProfiler.requiredSources(
      options.with({
        paths,
        base_path: options.contracts_directory,
        resolver: options.resolver
      })
    );

    await checkLigo();

    const compilationResult = await compileLigo(paths);

    return {
      compilations: []
    };
  },

  async sources({ sources, options }: { sources: object; options: object; }): Promise<CompilerResult> {
    return {
      compilations: []
    };
  },

  async sourcesWithDependencies({ paths, options }: { paths: string[]; options: object; }): Promise<CompilerResult> {
    return {
      compilations: []
    };
  },

  // async display(paths: any, options: any) {
  // }
};

export { Compile };