<script lang="ts" setup>
import {computed, onUnmounted, ref, watch} from 'vue';
import {type CropSettings, Pawn} from '@/models/Pawn';
import {PAWN_SIZES, type PawnSize, SPACER_BAR_HEIGHT, PAWN_NAME_HEIGHT, PAWN_NAME_MARGIN} from '@/models/Settings';
import CropModal from './CropModal.vue';
import {renderTextToDataUrl} from '@/utils/textRenderer';

const props = defineProps<{
  pawn: Pawn;
}>();

const emit = defineEmits<{
  (e: 'remove'): void;
  (e: 'remove-all'): void;
  (e: 'update', data: { crop: CropSettings, size: PawnSize, pawnName: string, startColourIndex: number }): void;
}>();

const imageUrl = ref<string>('');
const showCropModal = ref(false);

const openCropModal = () => {
  showCropModal.value = true;
};

const handleCropSave = (data: { crop: CropSettings, size: PawnSize, pawnName: string, startColourIndex: number }) => {
  emit('update', data);
  showCropModal.value = false;
};

const updateImageUrl = () => {
  if (typeof props.pawn.image === 'string') {
    imageUrl.value = props.pawn.image;
  } else if (props.pawn.image instanceof File) {
    if (imageUrl.value && imageUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl.value);
    }
    imageUrl.value = URL.createObjectURL(props.pawn.image);
  }
};

watch(() => props.pawn.image, updateImageUrl, {immediate: true});

onUnmounted(() => {
  if (imageUrl.value && imageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(imageUrl.value);
  }
});

const pawnNameDataUrl = ref<string>('');

const updatePawnNameImage = () => {
  if (props.pawn.pawnName) {
    pawnNameDataUrl.value = renderTextToDataUrl(props.pawn.pawnName, PAWN_NAME_HEIGHT * 10);
  } else {
    pawnNameDataUrl.value = '';
  }
};

watch(() => props.pawn.pawnName, updatePawnNameImage, {immediate: true});

const sizeStyle = computed(() => {
  const {width, height} = PAWN_SIZES[props.pawn.size];
  return {
    width: `${width}mm`,
    height: `${height}mm`,
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative' as const
  };
});

const pawnNameStyle = computed(() => {
  const {width} = PAWN_SIZES[props.pawn.size];
  const lines = props.pawn.pawnName.split('\n').length;
  return {
    position: 'absolute' as const,
    top: `${PAWN_NAME_MARGIN}mm`,
    width: `${width}mm`,
    height: `${PAWN_NAME_HEIGHT * lines}mm`,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    pointerEvents: 'none' as const
  };
});

const reflectedPawnNameStyle = computed(() => {
  const {width} = PAWN_SIZES[props.pawn.size];
  const lines = props.pawn.pawnName.split('\n').length;
  return {
    position: 'absolute' as const,
    bottom: `${PAWN_NAME_MARGIN}mm`,
    width: `${width}mm`,
    height: `${PAWN_NAME_HEIGHT * lines}mm`,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    pointerEvents: 'none' as const,
    transform: 'rotate(180deg)'
  };
});

const pawnNameImageStyle = computed(() => {
  return {
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 1mm white) drop-shadow(0 0 1mm white) drop-shadow(0 0 1mm white)'
  };
});

const imageStyle = computed(() => {
  return {
    transform: `translate(${props.pawn.crop.x}%, ${props.pawn.crop.y}%) scale(${props.pawn.crop.scale})`,
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
  };
});

const reflectedImageStyle = computed(() => {
  return {
    ...imageStyle.value,
    transform: `translate(${props.pawn.crop.x}%, ${-props.pawn.crop.y}%) scale(${props.pawn.crop.scale}) scaleY(-1)`
  };
});

const reflectedSizeStyle = computed(() => {
  return {
    ...sizeStyle.value,
  };
});
</script>

<template>
  <div :title="pawn.name" class="pawn-container" @dblclick="openCropModal">
    <div class="pawn-visual">
      <div :style="reflectedSizeStyle" class="reflected">
        <img :alt="pawn.name" :src="imageUrl" :style="reflectedImageStyle"/>
        <div v-if="pawn.pawnName" :style="reflectedPawnNameStyle">
          <img :src="pawnNameDataUrl" :style="pawnNameImageStyle" alt=""/>
        </div>
        <div v-if="pawn.showIndex" :style="{ backgroundColor: pawn.colour, color: 'white' }"
             class="pawn-index upside-down">{{ pawn.index }}
        </div>
      </div>
      <div :style="{ backgroundColor: pawn.colour, height: `${SPACER_BAR_HEIGHT}mm` }" class="spacer-bar"></div>
      <div :style="sizeStyle">
        <img :alt="pawn.name" :src="imageUrl" :style="imageStyle"/>
        <div v-if="pawn.pawnName" :style="pawnNameStyle">
          <img :src="pawnNameDataUrl" :style="pawnNameImageStyle" alt=""/>
        </div>
        <div v-if="pawn.showIndex" :style="{ backgroundColor: pawn.colour, color: 'white' }" class="pawn-index">
          {{ pawn.index }}
        </div>
      </div>
    </div>
    <!--<p v-if="pawn.name">{{ pawn.name }}</p>-->

    <CropModal
        v-if="showCropModal"
        :image-url="imageUrl"
        :pawn="pawn"
        @close="showCropModal = false"
        @delete="emit('remove')"
        @save="handleCropSave"
        @delete-all="emit('remove-all')"
    />
  </div>
</template>

<style>
@media print {
  .pawn-container {
    page-break-inside: avoid;
    break-inside: avoid;
    display: inline-flex !important;
    border: 0.5pt dashed #999 !important; /* Use pt for border to be more precise in print */
    padding: 0 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    visibility: visible !important;
  }

  /*.pawn-index {
    display: none !important;
  }*/
}
</style>

<style scoped>
.pawn-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  border: 1px dashed #999;
  padding: 0;
}

.pawn-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.spacer-bar {
  width: 100%;
}

.pawn-index {
  position: absolute;
  bottom: calc(10mm - 0.6rem);
  right: 2px;
  border-radius: 50%;
  width: 1.2rem;
  height: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
  pointer-events: none;
}

.pawn-index.upside-down {
  transform: rotate(180deg);
  top: calc(10mm - 0.6rem);
  right: 2px;
  bottom: auto;
  left: auto;
}

p {
  margin-top: 4px;
  font-size: 0.8rem;
  text-align: center;
}
</style>
