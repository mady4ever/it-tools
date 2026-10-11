<script setup lang="ts">
const formats = [
  { value: 'image/jpeg', label: 'JPEG', ext: 'jpg' },
  { value: 'image/webp', label: 'WebP', ext: 'webp' },
  { value: 'image/png', label: 'PNG', ext: 'png' },
];

const source = ref<File | null>(null);
const format = ref('image/jpeg');
const quality = ref(80);
const maxSide = ref(1600);
const busy = ref(false);
const error = ref('');
const result = ref<{ blob: Blob; url: string; width: number; height: number } | null>(null);

function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  source.value = file;
  error.value = '';
  clearResult();
}

function clearResult() {
  if (result.value) URL.revokeObjectURL(result.value.url);
  result.value = null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function optimize() {
  if (!source.value) return;
  busy.value = true;
  error.value = '';
  clearResult();
  try {
    const bitmap = await createImageBitmap(source.value);
    const scale = Math.min(1, maxSide.value / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available in this browser.');
    if (format.value === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, format.value, quality.value / 100));
    if (!blob || blob.type !== format.value) throw new Error('This browser cannot encode that format. Try JPEG or PNG.');
    result.value = { blob, url: URL.createObjectURL(blob), width, height };
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not read that image.';
  }
  finally {
    busy.value = false;
  }
}

const outputName = computed(() => {
  const base = (source.value?.name ?? 'image').replace(/\.[^.]+$/, '');
  const ext = formats.find(f => f.value === format.value)?.ext ?? 'jpg';
  return `${base}-optimized.${ext}`;
});

function download() {
  if (!result.value) return;
  const a = document.createElement('a');
  a.href = result.value.url;
  a.download = outputName.value;
  a.click();
}

onBeforeUnmount(clearResult);
</script>

<template>
  <div>
    <n-alert type="info" mb-4>
      Everything runs in your browser. Re-encoding removes EXIF metadata such as GPS location and camera details.
    </n-alert>

    <div mb-4>
      <label for="image-optimizer-file" mb-1 block>Image</label>
      <input id="image-optimizer-file" data-testid="image-optimizer-file" type="file" accept="image/*" @change="onFile">
    </div>

    <n-form label-placement="left" label-width="120">
      <n-form-item label="Format">
        <n-select v-model:value="format" :options="formats.map(f => ({ label: f.label, value: f.value }))" />
      </n-form-item>
      <n-form-item v-if="format !== 'image/png'" label="Quality">
        <n-slider v-model:value="quality" :min="30" :max="100" :step="5" />
        <span ml-3 w-12>{{ quality }}%</span>
      </n-form-item>
      <n-form-item label="Longest side (px)">
        <n-input-number v-model:value="maxSide" :min="64" :max="8000" />
      </n-form-item>
    </n-form>

    <c-button :disabled="!source || busy" data-testid="image-optimizer-run" @click="optimize">
      {{ busy ? 'Working…' : 'Optimize' }}
    </c-button>

    <n-alert v-if="error" type="error" mt-4>
      {{ error }}
    </n-alert>

    <div v-if="result && source" mt-4 data-testid="image-optimizer-result">
      <p>
        {{ formatBytes(source.size) }} → {{ formatBytes(result.blob.size) }}
        ({{ result.width }}×{{ result.height }})
      </p>
      <img :src="result.url" alt="Optimized preview" style="max-width: 100%; max-height: 260px" my-3>
      <div>
        <c-button data-testid="image-optimizer-download" @click="download">
          Download {{ outputName }}
        </c-button>
      </div>
    </div>
  </div>
</template>
