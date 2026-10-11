<script setup lang="ts">
import { PDFDocument } from 'pdf-lib';
import { offerAsendmeFile } from '@/asendme-bridge';

const files = ref<File[]>([]);
const busy = ref(false);
const error = ref('');
const result = ref<{ url: string; pages: number; size: number } | null>(null);

function clearResult() {
  if (result.value) URL.revokeObjectURL(result.value.url);
  result.value = null;
}

function onFiles(event: Event) {
  const picked = Array.from((event.target as HTMLInputElement).files ?? []);
  files.value = [...files.value, ...picked];
  (event.target as HTMLInputElement).value = '';
  error.value = '';
  clearResult();
}

function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= files.value.length) return;
  const next = [...files.value];
  [next[index], next[target]] = [next[target], next[index]];
  files.value = next;
  clearResult();
}

function remove(index: number) {
  files.value = files.value.filter((_, i) => i !== index);
  clearResult();
}

async function merge() {
  busy.value = true;
  error.value = '';
  clearResult();
  try {
    const out = await PDFDocument.create();
    for (const file of files.value) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (file.type.startsWith('image/') && file.type !== 'image/jpeg' && file.type !== 'image/png') {
        throw new Error(`${file.name}: only PDF, JPEG and PNG files are supported.`);
      }
      if (file.type === 'image/jpeg' || file.type === 'image/png') {
        const image = file.type === 'image/png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const page = out.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }
      else {
        const doc = await PDFDocument.load(bytes);
        const pages = await out.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => out.addPage(p));
      }
    }
    const saved = await out.save();
    const blob = new Blob([saved], { type: 'application/pdf' });
    result.value = { url: URL.createObjectURL(blob), pages: out.getPageCount(), size: blob.size };
    offerAsendmeFile(blob, 'merged.pdf');
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not merge those files.';
  }
  finally {
    busy.value = false;
  }
}

function download() {
  if (!result.value) return;
  const a = document.createElement('a');
  a.href = result.value.url;
  a.download = 'merged.pdf';
  a.click();
}

onBeforeUnmount(clearResult);
</script>

<template>
  <div>
    <n-alert type="info" mb-4>
      Everything runs in your browser. Combine PDFs, JPEG and PNG photos into one PDF.
    </n-alert>

    <div mb-4>
      <label for="pdf-merger-files" mb-1 block>Add files</label>
      <input id="pdf-merger-files" data-testid="pdf-merger-files" type="file" multiple accept="application/pdf,image/jpeg,image/png" @change="onFiles">
    </div>

    <ol v-if="files.length" mb-4 pl-5>
      <li v-for="(file, i) in files" :key="`${file.name}-${i}`" mb-1>
        {{ file.name }}
        <c-button size="small" :disabled="i === 0" @click="move(i, -1)">
          ↑
        </c-button>
        <c-button size="small" :disabled="i === files.length - 1" @click="move(i, 1)">
          ↓
        </c-button>
        <c-button size="small" @click="remove(i)">
          Remove
        </c-button>
      </li>
    </ol>

    <c-button :disabled="!files.length || busy" data-testid="pdf-merger-run" @click="merge">
      {{ busy ? 'Working…' : 'Merge' }}
    </c-button>

    <n-alert v-if="error" type="error" mt-4>
      {{ error }}
    </n-alert>

    <div v-if="result" mt-4 data-testid="pdf-merger-result">
      <p>{{ result.pages }} page(s), {{ (result.size / 1024).toFixed(1) }} KB</p>
      <c-button data-testid="pdf-merger-download" @click="download">
        Download merged.pdf
      </c-button>
    </div>
  </div>
</template>
