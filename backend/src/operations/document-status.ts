import { BadRequestException } from '@nestjs/common';
import { DocStatus } from '@prisma/client';

type ClaimableDelegate = {
  updateMany(args: {
    where: { id: string; status: { notIn: DocStatus[] } };
    data: { status: DocStatus };
  }): Promise<{ count: number }>;
};

/**
 * Atomic compare-and-set that lets exactly one validate() post a document.
 * Call it first inside the validate transaction: the UPDATE row-locks the
 * document, so a concurrent caller waits, then matches 0 rows and aborts
 * before posting anything (#16). If the winner rolls back (e.g. not enough
 * stock), the status reverts and a retry can still validate.
 */
export async function claimForValidation(docs: ClaimableDelegate, id: string, label: string) {
  const claimed = await docs.updateMany({
    where: { id, status: { notIn: [DocStatus.DONE, DocStatus.CANCELED] } },
    data: { status: DocStatus.DONE },
  });
  if (claimed.count === 0) {
    throw new BadRequestException(`${label} is already validated or canceled`);
  }
}

/** DONE is only reachable through validate(), which posts the ledger moves. */
export function assertNotMarkingDone(status: DocStatus | undefined, label: string) {
  if (status === DocStatus.DONE) {
    throw new BadRequestException(`Use the validate endpoint to mark a ${label} as DONE`);
  }
}
