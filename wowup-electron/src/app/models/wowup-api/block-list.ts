export interface CurseAuthorBlockRepresentation {
  authorId: string;
}

export interface CurseBlocksRepresentation {
  authors: CurseAuthorBlockRepresentation[];
}

export interface BlockListRepresentation {
  curse: CurseBlocksRepresentation;
}
