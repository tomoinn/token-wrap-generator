<script lang="ts" setup>
import { PAWN_COLORS } from '@/models/Settings';

defineProps<{
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'select', count: number): void;
  (e: 'close'): void;
}>();
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <h2>{{ title || 'Select Number of Copies' }}</h2>
      <div class="count-buttons">
        <button
            v-for="n in 10"
            :key="n"
            :style="{ backgroundColor: PAWN_COLORS[n-1], color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }"
            class="count-button"
            @click="emit('select', n)"
        >
          {{ n }}
        </button>
      </div>
      <button class="danger cancel-button" @click="emit('close')">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  max-width: 90%;
  width: 400px;
  text-align: center;
  color: black;
}

.modal-content h2 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.count-buttons {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.count-button {
  padding: 1rem;
  font-size: 1.2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.1s, opacity 0.2s;
  font-weight: bold;
}

.count-button:hover {
  opacity: 0.9;
  transform: scale(1.05);
}

.count-button:active {
  transform: scale(0.95);
}

.cancel-button {
  margin-top: 0.5rem;
}
</style>
