<script setup lang="ts">
import { computed, ref } from 'vue';
import { Pawn, PawnSize, PAWN_SIZES } from '../models/Pawn';

const props = defineProps<{
  pawn: Pawn;
  imageUrl: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', data: { crop: { x: number; y: number; scale: number }, size: PawnSize }): void;
  (e: 'delete'): void;
  (e: 'delete-all'): void;
}>();

const cropX = ref(props.pawn.crop.x);
const cropY = ref(props.pawn.crop.y);
const scale = ref(props.pawn.crop.scale);
const selectedSize = ref(props.pawn.size);

const isDragging = ref(false);
const startMouseX = ref(0);
const startMouseY = ref(0);
const startCropX = ref(0);
const startCropY = ref(0);
const imgRef = ref<HTMLImageElement | null>(null);

const previewStyle = computed(() => {
  const { width, height } = PAWN_SIZES[selectedSize.value];
  const scaleFactor = 3; // Scale mm to px for preview
  return {
    width: `${width * scaleFactor}px`,
    height: `${height * scaleFactor}px`
  };
});

const startDrag = (e: MouseEvent | TouchEvent) => {
  if (!imgRef.value) return;
  isDragging.value = true;
  
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

  startMouseX.value = clientX;
  startMouseY.value = clientY;
  startCropX.value = Number(cropX.value);
  startCropY.value = Number(cropY.value);

  if ('touches' in e) {
    window.addEventListener('touchmove', onDrag, { passive: false });
    window.addEventListener('touchend', stopDrag);
  } else {
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
  }
  
  if (e.cancelable) e.preventDefault();
};

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value || !imgRef.value) return;

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

  const dx = clientX - startMouseX.value;
  const dy = clientY - startMouseY.value;

  // We need to convert pixel movement to percentage
  // The cropX/Y are percentages of the image size (effectively)
  // Since the image is max-width: 100%, max-height: 100% in a 200x250 box
  // We can use the actual rendered size of the image for conversion.
  const rect = imgRef.value.getBoundingClientRect();
  
  if (rect.width > 0) {
    const percentX = (dx / rect.width) * 100;
    cropX.value = Math.round((startCropX.value + percentX) * 100) / 100;
  }
  
  if (rect.height > 0) {
    const percentY = (dy / rect.height) * 100;
    cropY.value = Math.round((startCropY.value + percentY) * 100) / 100;
  }

  if ('touches' in e && e.cancelable) e.preventDefault();
};

const stopDrag = () => {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
  window.removeEventListener('touchmove', onDrag);
  window.removeEventListener('touchend', stopDrag);
};

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const newScale = Math.round((Number(scale.value) + delta) * 10) / 10;
  scale.value = Math.max(0.1, Math.min(5, newScale));
};

const reset = () => {
  cropX.value = 0;
  cropY.value = 0;
  scale.value = 1;
  selectedSize.value = props.pawn.size;
};

const save = () => {
  emit('save', {
    crop: {
      x: Number(cropX.value),
      y: Number(cropY.value),
      scale: Number(scale.value)
    },
    size: selectedSize.value
  });
};
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <h3>Edit Crop: {{ pawn.name }}</h3>
      
      <div class="preview-container">
        <div class="preview-box" :style="previewStyle" @mousedown="startDrag" @touchstart="startDrag" @wheel="handleWheel">
          <img 
            ref="imgRef"
            :src="imageUrl" 
            :style="{
              transform: `translate(${cropX}%, ${cropY}%) scale(${scale})`,
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }"
            draggable="false"
          />
        </div>
      </div>

      <div class="controls">
        <div class="control-group">
          <label>Pawn Size</label>
          <select v-model="selectedSize">
            <option v-for="(dims, size) in PAWN_SIZES" :key="size" :value="size">
              {{ size.charAt(0).toUpperCase() + size.slice(1) }} ({{ dims.width }} x {{ dims.height }}mm)
            </option>
          </select>
        </div>
        <div class="control-group">
          <label>Scale: {{ scale }}</label>
          <input type="range" v-model="scale" min="0.1" max="5" step="0.1" />
        </div>
        <div class="control-group">
          <label>X Offset: {{ cropX }}%</label>
          <input type="range" v-model="cropX" min="-100" max="100" step="1" />
        </div>
        <div class="control-group">
          <label>Y Offset: {{ cropY }}%</label>
          <input type="range" v-model="cropY" min="-100" max="100" step="1" />
        </div>
      </div>

      <div class="actions">
        <button @click="emit('delete-all')" class="danger">Delete All</button>
        <button @click="emit('delete')" class="danger">Delete</button>
        <div class="spacer"></div>
        <button @click="reset" class="secondary">Reset</button>
        <button @click="emit('close')">Cancel</button>
        <button @click="save" class="primary">Save</button>
      </div>
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
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  color: black;
}

.preview-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  background: #eee;
  padding: 10px;
  border-radius: 4px;
}

.preview-box {
  overflow: hidden;
  border: 1px solid #ccc;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: move;
  user-select: none;
}

.preview-box img {
  /* No max-width/height here so image can be scaled/cropped properly */
}

.controls {
  margin-bottom: 20px;
}

.control-group {
  margin-bottom: 10px;
}

.control-group label {
  display: block;
  margin-bottom: 5px;
}

.control-group input,
.control-group select {
  width: 100%;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.spacer {
  flex-grow: 1;
}

button {
  padding: 8px 16px;
  cursor: pointer;
}

button.primary {
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
}

button.danger {
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
}
</style>
