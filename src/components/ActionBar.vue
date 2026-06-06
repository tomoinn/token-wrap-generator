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
    <button @click="$emit('exportState')">Save</button>
    <button @click="$emit('exportToSVG')">Export SVG</button>
    <button @click="$emit('print')">Print</button>
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
  margin-right: 2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

button {
  padding: 0.5rem 1rem;
  font-size: 1.1rem;
  cursor: pointer;
  background-color: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
}

button:hover {
  background-color: #33a06f;
}

@media print {
  .no-print {
    display: none !important;
  }
}
</style>
