<script lang="ts" setup>
import {computed, onMounted, onUnmounted, ref, watch} from 'vue';
import {Pawn} from '@/models/Pawn';
import {PAWN_COLORS, PAWN_NAME_HEIGHT, PAWN_NAME_MARGIN, PAWN_SIZES, type PawnSize} from '@/models/Settings';
import {renderTextToDataUrl} from "@/utils/textRenderer";

const props = defineProps<{
  pawn: Pawn;
  imageUrl: string;
  showDeleteAll?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', data: {
    crop: { x: number; y: number; scale: number },
    size: PawnSize,
    pawnName: string,
    startColourIndex: number
  }): void;
  (e: 'request-add-copies', data: {
    crop: { x: number; y: number; scale: number },
    size: PawnSize,
    pawnName: string,
    startColourIndex: number
  }): void;
  (e: 'delete'): void;
  (e: 'delete-all'): void;
}>();

const cropX = ref(props.pawn.crop.x);
const cropY = ref(props.pawn.crop.y);
const scale = ref(props.pawn.crop.scale);
const selectedSize = ref(props.pawn.size);
const pawnName = ref(props.pawn.pawnName);
const startColourIndex = ref(props.pawn.startColourIndex || 0);

const isDragging = ref(false);
const startMouseX = ref(0);
const startMouseY = ref(0);
const startCropX = ref(0);
const startCropY = ref(0);
const imgRef = ref<HTMLImageElement | null>(null);

const pawnNameDataUrl = ref<string>('');

const updatePawnNameImage = () => {
  if (pawnName.value) {
    pawnNameDataUrl.value = renderTextToDataUrl(pawnName.value, PAWN_NAME_HEIGHT * 10);
  } else {
    pawnNameDataUrl.value = '';
  }
};

watch(pawnName, updatePawnNameImage, {immediate: true});

const previewScaleFactor = computed(() => {
  const {height} = PAWN_SIZES[selectedSize.value];
  const targetHeight = 400; // Fixed height in pixels for the preview
  return targetHeight / height;
});

const previewStyle = computed(() => {
  const {width} = PAWN_SIZES[selectedSize.value];
  const scaleFactor = previewScaleFactor.value;
  const targetHeight = 400;
  return {
    width: `${width * scaleFactor}px`,
    height: `${targetHeight}px`
  };
});

const pawnNamePreviewStyle = computed(() => {
  const {width} = PAWN_SIZES[selectedSize.value];
  const scaleFactor = previewScaleFactor.value;
  const lines = pawnName.value.split('\n').length;
  return {
    position: 'absolute' as const,
    top: `${PAWN_NAME_MARGIN * scaleFactor}px`,
    width: `${width * scaleFactor}px`,
    height: `${PAWN_NAME_HEIGHT * lines * scaleFactor}px`,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    pointerEvents: 'none' as const,
    zIndex: 1
  };
});

const pawnNameImageStyle = computed(() => {
  const scaleFactor = previewScaleFactor.value;
  const shadowSize = 1 * scaleFactor;
  return {
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
    filter: `drop-shadow(0 0 ${shadowSize}px white) drop-shadow(0 0 ${shadowSize}px white) drop-shadow(0 0 ${shadowSize}px white)`
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
    window.addEventListener('touchmove', onDrag, {passive: false});
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
  const delta = e.deltaY > 0 ? -0.01 : 0.01;
  const newScale = Math.round((Number(scale.value) + delta) * 100) / 100;
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
    size: selectedSize.value,
    pawnName: pawnName.value,
    startColourIndex: startColourIndex.value
  });
};

const requestAddCopies = () => {
  emit('request-add-copies', {
    crop: {
      x: Number(cropX.value),
      y: Number(cropY.value),
      scale: Number(scale.value)
    },
    size: selectedSize.value,
    pawnName: pawnName.value,
    startColourIndex: startColourIndex.value
  });
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content crop-modal">
      <h3>Edit Pawn: {{ pawn.name }}</h3>
      <div class="help-text">Drag image to position, mouse wheel or scale bar to resize, reset sets crop and scale to
        default. ESC or click outside this dialogue to close without saving. Changes affect all copies of this pawn.
      </div>

      <div class="preview-container">
        <div :style="previewStyle" class="preview-box" @mousedown="startDrag" @touchstart="startDrag"
             @wheel="handleWheel">
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
          <div v-if="pawnName" :style="pawnNamePreviewStyle">
            <img :src="pawnNameDataUrl" :style="pawnNameImageStyle" alt=""/>
          </div>
        </div>
      </div>

      <div class="controls">
        <div class="control-group">
          <label>Pawn Name</label>
          <textarea v-model="pawnName" placeholder="Enter pawn name..." rows="2"></textarea>
        </div>
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
          <input v-model="scale" max="5" min="0.1" step="0.01" type="range"/>
        </div>

        <div class="control-group">
          <label>Starting Colour</label>
          <div class="color-picker">
            <div
                v-for="(color, index) in PAWN_COLORS"
                :key="index"
                :class="{ selected: startColourIndex === index }"
                :style="{ backgroundColor: color }"
                class="color-option"
                @click="startColourIndex = index"
            ></div>
          </div>
        </div>
      </div>

      <div class="actions">
        <button v-if="showDeleteAll" class="danger" @click="emit('delete-all')">Delete All Copies</button>
        <button class="danger" @click="emit('delete')">Delete</button>
        <div class="spacer"></div>
        <button class="secondary" @click="requestAddCopies">Add Copies</button>
        <button class="secondary" @click="reset">Reset</button>
        <button class="primary" @click="save">
          Save
        </button>
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
  max-width: 600px;
  width: 95%;
  color: black;
}

.preview-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  background: none;
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
  background: white;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
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
.control-group select,
.control-group textarea {
  width: 100%;
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 5px;
}

.color-option {
  width: 30px;
  height: 30px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.1s;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: #333;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
}

.control-group textarea {
  resize: vertical;
  font-family: inherit;
  padding: 4px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.spacer {
  flex-grow: 1;
}

.crop-modal {
  background: #efefef;
}

.help-text {
  font-size: 14px;
  color: #666;
  font-style: italic;
}
</style>
