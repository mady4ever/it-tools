<script setup lang="ts">
import { PDFDocument } from 'pdf-lib';

interface Page { id: number; name: string; source: Blob; rotation: number; mode: 'color' | 'document'; thumb: string }

const MAX_PAGES = 30;
const MAX_EDGE = 1800;
const pages = ref<Page[]>([]);
const busy = ref(false);
const error = ref('');
const result = ref<{ url: string; pages: number; size: number } | null>(null);
let nextId = 1;

function clearResult() {
  if (result.value) URL.revokeObjectURL(result.value.url);
  result.value = null;
}

async function render(page: Page, maxEdge: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(page.source, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const turned = page.rotation % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = turned ? h : w;
  canvas.height = turned ? w : h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((page.rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  bitmap.close();
  if (page.mode === 'document') {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    let lo = 255;
    let hi = 0;
    for (let i = 0; i < px.length; i += 4) {
      const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114);
      px[i] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    const range = Math.max(40, hi - lo);
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((px[i] - lo) / range) * 255 * 1.1));
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
  }
  return canvas;
}

async function refreshThumb(page: Page) {
  const canvas = await render(page, 240);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7));
  if (page.thumb) URL.revokeObjectURL(page.thumb);
  page.thumb = blob ? URL.createObjectURL(blob) : '';
}

async function onFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const picked = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/'));
  input.value = '';
  error.value = '';
  clearResult();
  for (const file of picked) {
    if (pages.value.length >= MAX_PAGES) {
      error.value = `Up to ${MAX_PAGES} pages per document.`;
      break;
    }
    try {
      const page: Page = reactive({ id: nextId++, name: file.name, source: file, rotation: 0, mode: 'document', thumb: '' });
      await refreshThumb(page);
      pages.value.push(page);
    }
    catch {
      error.value = `${file.name} could not be read as an image.`;
    }
  }
}

async function rotate(page: Page) {
  page.rotation = (page.rotation + 90) % 360;
  clearResult();
  await refreshThumb(page);
}

async function toggleMode(page: Page) {
  page.mode = page.mode === 'document' ? 'color' : 'document';
  clearResult();
  await refreshThumb(page);
}

function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= pages.value.length) return;
  const next = [...pages.value];
  [next[index], next[target]] = [next[target], next[index]];
  pages.value = next;
  clearResult();
}

function remove(index: number) {
  const [gone] = pages.value.splice(index, 1);
  if (gone?.thumb) URL.revokeObjectURL(gone.thumb);
  clearResult();
}

async function build() {
  busy.value = true;
  error.value = '';
  clearResult();
  try {
    const pdf = await PDFDocument.create();
    for (const page of pages.value) {
      const canvas = await render(page, MAX_EDGE);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (!blob) throw new Error('Could not encode a page.');
      const image = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const out = pdf.addPage([image.width, image.height]);
      out.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
    const saved = await pdf.save();
    const file = new Blob([saved], { type: 'application/pdf' });
    result.value = { url: URL.createObjectURL(file), pages: pdf.getPageCount(), size: file.size };
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not build the PDF.';
  }
  finally {
    busy.value = false;
  }
}

function download() {
  if (!result.value) return;
  const a = document.createElement('a');
  a.href = result.value.url;
  a.download = 'scan.pdf';
  a.click();
}

onBeforeUnmount(() => {
  clearResult();
  pages.value.forEach(p => p.thumb && URL.revokeObjectURL(p.thumb));
});
</script>

<template>
  <div>
    <n-alert type="info" mb-4>
      Scan paper to a PDF on this device. Nothing is uploaded. Photos are cleaned up locally, and location and camera details are not kept.
    </n-alert>

    <div mb-4 flex flex-wrap gap-4>
      <label>
        <span mb-1 block>Take a photo</span>
        <input data-testid="scanner-camera" type="file" accept="image/*" capture="environment" @change="onFiles">
      </label>
      <label>
        <span mb-1 block>Or choose images</span>
        <input data-testid="scanner-files" type="file" accept="image/*" multiple @change="onFiles">
      </label>
    </div>

    <ol v-if="pages.length" mb-4 pl-0 style="list-style: none">
      <li v-for="(page, i) in pages" :key="page.id" mb-3 flex items-center gap-3 data-testid="scanner-page">
        <img :src="page.thumb" :alt="`Page ${i + 1}`" style="width: 72px; height: 96px; object-fit: contain; background: #fff; border-radius: 4px">
        <div flex flex-wrap gap-2>
          <span>Page {{ i + 1 }}</span>
          <c-button size="small" :disabled="i === 0" @click="move(i, -1)">
            ↑
          </c-button>
          <c-button size="small" :disabled="i === pages.length - 1" @click="move(i, 1)">
            ↓
          </c-button>
          <c-button size="small" @click="rotate(page)">
            Rotate
          </c-button>
          <c-button size="small" @click="toggleMode(page)">
            {{ page.mode === 'document' ? 'Document' : 'Colour' }}
          </c-button>
          <c-button size="small" @click="remove(i)">
            Remove
          </c-button>
        </div>
      </li>
    </ol>

    <c-button :disabled="!pages.length || busy" data-testid="scanner-build" @click="build">
      {{ busy ? 'Working…' : 'Create PDF' }}
    </c-button>

    <n-alert v-if="error" type="error" mt-4>
      {{ error }}
    </n-alert>

    <div v-if="result" mt-4 data-testid="scanner-result">
      <p>{{ result.pages }} page(s), {{ (result.size / 1024).toFixed(1) }} KB</p>
      <c-button data-testid="scanner-download" @click="download">
        Download scan.pdf
      </c-button>
    </div>
  </div>
</template>
