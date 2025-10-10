import { DockerVolumeMapInterface } from './docker.volume.interface';

export interface DockerRunnerOptionsInterface {
  image: string;
  projectPath?: string;
  packagedSrcPath?: string;
  cargoTargetDir?: string;
  dockerInteractive?: boolean;
  dockerArgs?: string;
  noWasmOpt?: string;
  outputVolumeMap?: DockerVolumeMapInterface;
  inputVolumeMap?: DockerVolumeMapInterface;
  dockerTty?: boolean;
  noDockerTty?: boolean;
  contractPath?: string;
}
