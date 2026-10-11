<script setup lang="ts">
const note = useStorage('shared-note:text', '');
const message = ref('');

function formatJson() {
  try {
    note.value = JSON.stringify(JSON.parse(note.value), null, 2);
    message.value = '';
  }
  catch {
    message.value = 'This is not valid JSON.';
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(note.value);
    message.value = 'Copied. Tap "Send to nearby" to send it to another device.';
  }
  catch {
    message.value = 'Select the text and use "Send to nearby".';
  }
}
</script>

<template>
  <div>
    <n-alert type="info" mb-4>
      A note or JSON snippet saved on this device only. To move it to your other devices, copy it and use "Send to nearby"; the other device must accept it.
    </n-alert>
    <c-input-text
      v-model:value="note"
      data-testid="shared-note-text"
      multiline
      placeholder="Type a note or paste JSON…"
      rows="10"
      raw-text
    />
    <div mt-3 flex gap-2>
      <c-button data-testid="shared-note-copy" @click="copy">
        Copy
      </c-button>
      <c-button @click="formatJson">
        Format as JSON
      </c-button>
      <c-button @click="note = ''">
        Clear
      </c-button>
    </div>
    <p v-if="message" mt-3 data-testid="shared-note-message">
      {{ message }}
    </p>
  </div>
</template>
