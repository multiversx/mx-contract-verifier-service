import { ApiProperty } from "@nestjs/swagger";
import { VerifierDeletionPayload } from "./verifier.deletion.payload";

export class VerifierDeletion {
  constructor(partial?: Partial<VerifierDeletion>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: "Payload signature", type: String })
  signature: string = "";

  @ApiProperty({ description: "Payload", type: VerifierDeletionPayload })
  payload!: VerifierDeletionPayload;
}
