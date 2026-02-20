export interface NoteSummary {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  relativePath: string;
}

export interface Note extends NoteSummary {
  content: string;
  attachments: Attachment[];
}
