import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import os from 'os';
import { DockerRunnerOptionsInterface } from './entities/docker.runner.interface';

export class DockerRunner {
  private logger = new Logger('Docker');

  public exec(options: DockerRunnerOptionsInterface): Promise<string> {
    const mountArgs = [];

    if (options.inputVolumeMap) {
      mountArgs.push(
        '--volume',
        `${options.inputVolumeMap.from}:${options.inputVolumeMap.to}`,
      );
    }

    if (options.outputVolumeMap) {
      mountArgs.push(
        '--volume',
        `${options.outputVolumeMap.from}:${options.outputVolumeMap.to}`,
      );
    }

    if (options.packagedSrcPath) {
      mountArgs.push('--volume', `${options.packagedSrcPath}:/package-src.json`);
    }

    if (options.cargoTargetDir) {
      mountArgs.push('--volume', `${options.cargoTargetDir}:/cargo-target-dir`);
    }

    const args = ['docker', 'run'];

    if (options.dockerInteractive) {
      args.push('--interactive');
    }

    if (options.dockerTty) {
      args.push('--tty');
    }

    args.push(...mountArgs);
    const userInfo = os.userInfo();
    args.push('--user', `${userInfo.uid}:${userInfo.gid}`);
    args.push('--rm', options.image);

    const entrypointsArgs = [];

    if (options.projectPath) {
      entrypointsArgs.push('--project', 'project');
    }

    if (options.packagedSrcPath) {
      entrypointsArgs.push('--packaged-src', 'packaged-src.json');
    }

    if (options.noWasmOpt) {
      entrypointsArgs.push('--no-wasm-opt');
    }

    if (options.contractPath) {
      entrypointsArgs.push('--contract', options.contractPath);
    }

    args.push(...entrypointsArgs);

    this.logger.log(`Running docker with following args: ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      exec(args.join(' '), (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }

        if (stderr) {
          return resolve(stderr);
        }

        return resolve(stdout);
      });
    });
  }
}
