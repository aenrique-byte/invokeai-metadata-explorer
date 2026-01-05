
export interface InvokeAIMetadata {
  generation_mode?: string;
  positive_prompt?: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  scheduler?: string;
  model?: {
    name: string;
    base: string;
  };
  loras?: Array<{
    model: { name: string };
    weight: number;
  }>;
}

export interface ImageRecord {
  id: string;
  file: File;
  previewUrl: string;
  metadata: InvokeAIMetadata | null;
  name: string;
  customName?: string;
  size: number;
  tags: string[];
  isLiked?: boolean;
}

export interface FilterState {
  search: string;
  selectedTags: string[];
  models: string[];
  onlyLiked: boolean;
}
