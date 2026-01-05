
import { InvokeAIMetadata } from '../types';

/**
 * Extracts InvokeAI metadata from a PNG file.
 * PNG Structure: 8-byte signature, then chunks.
 * Chunk: Length(4), Type(4), Data(Length), CRC(4).
 */
export async function extractInvokeAIMetadata(file: File): Promise<InvokeAIMetadata | null> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  // Check PNG Signature
  if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) {
    return null;
  }

  let offset = 8;
  const decoder = new TextDecoder();

  while (offset < view.byteLength) {
    const length = view.getUint32(offset);
    const type = decoder.decode(buffer.slice(offset + 4, offset + 8));
    
    // We are looking for tEXt chunks
    if (type === 'tEXt') {
      const data = new Uint8Array(buffer, offset + 8, length);
      const text = decoder.decode(data);
      
      // tEXt format is keyword\0content
      const nullIndex = text.indexOf('\0');
      if (nullIndex !== -1) {
        const keyword = text.substring(0, nullIndex);
        const content = text.substring(nullIndex + 1);

        if (keyword === 'invokeai_metadata') {
          try {
            return JSON.parse(content) as InvokeAIMetadata;
          } catch (e) {
            console.error('Failed to parse invokeai_metadata JSON', e);
          }
        }
      }
    }

    // Move to next chunk (Length + Type + Data + CRC)
    offset += 8 + length + 4;
    
    // Safety break for malformed files or extremely large ones
    if (offset > view.byteLength) break;
  }

  return null;
}

export function extractTagsFromPrompt(prompt: string | undefined): string[] {
  if (!prompt) return [];
  // Split by comma, clean up whitespace, remove weights like (tag:1.2)
  return prompt
    .split(',')
    .map(t => t.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim().toLowerCase())
    .filter(t => t.length > 2 && t.length < 30); // reasonable tag length
}
