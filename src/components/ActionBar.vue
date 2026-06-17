<script lang="ts" setup>
import {PAPER_SIZES, type PaperSize} from '@/models/Settings';

defineProps<{
  paperSize: PaperSize;
  paperMargin: number;
}>();

defineEmits<{
  (e: 'update:paperSize', value: PaperSize): void;
  (e: 'update:paperMargin', value: number): void;
  (e: 'exportState'): void;
  (e: 'exportToSVG'): void;
  (e: 'print'): void;
}>();
</script>

<template>
  <div class="actions no-print">
    <div class="paper-selector">
      <label for="paper-size">Paper&nbsp;Size:</label>
      <select
          id="paper-size"
          :value="paperSize"
          @change="$emit('update:paperSize', ($event.target as HTMLSelectElement).value as PaperSize)"
      >
        <option v-for="(dims, key) in PAPER_SIZES" :key="key" :value="key">
          {{ dims.name }} ({{ dims.width }}x{{ dims.height }}mm)
        </option>
      </select>
      <label class="margin-input-label" for="paper-margin">Margin&nbsp;(mm):</label>
      <input
          id="paper-margin"
          :value="paperMargin"
          class="margin-input"
          max="50"
          min="0"
          type="number"
          @input="$emit('update:paperMargin', Number(($event.target as HTMLInputElement).value))"
      />
    </div>
    <div class="buttons">
    <button class="primary" @click="$emit('exportState')">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
      Save
    </button>
    <button v-if="false" class="primary" @click="$emit('exportToSVG')">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
      SVG
    </button>
    <button class="primary" @click="$emit('print')">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      Print
    </button>
      </div>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  justify-content: left;
  margin-bottom: 2rem;
  gap: 1rem;
}

.paper-selector {
  margin-right: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.buttons {
  display: flex;
  gap: 0.5rem
}
.buttons>button{
  height: 33px;
}

.paper-selector select {
  padding: 0.4rem;
  font-size: 1rem;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.margin-input {
  width: 60px;
  padding: 0.4rem;
  font-size: 1rem;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.margin-input-label {
  margin-left: 15px;
}

@media print {
  .no-print {
    display: none !important;
  }
}
</style>
