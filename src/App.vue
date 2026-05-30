<script lang="ts" setup>
import {computed, ref, watch} from 'vue';
import {
  PAPER_SIZES,
  type PaperSize,
  Pawn,
  PAWN_COLORS,
  PAWN_SIZES,
  type PawnSize,
  SPACER_BAR_HEIGHT
} from './models/Pawn';
import PawnView from './components/PawnView.vue';

const pawns = ref<Pawn[]>([]);
const pages = ref<{
  pawns: Pawn[],
  metadata: Map<string, { isFirstInRow: boolean, isSameSizeAsPrevious: boolean, isLastRow: boolean }>
}[]>([]);
const pendingFiles = ref<File[]>([]);
const selectedSize = ref<PawnSize | null>(null);
const showSizeDialog = ref(false);
const showCountDialog = ref(false);
const selectedPaperSize = ref<PaperSize>('A4');
const paperMargin = ref(5);

const paperDims = computed(() => {
  return PAPER_SIZES[selectedPaperSize.value];
});

const updatePawnIndices = () => {
  const counts = new Map<string, number>();
  const totalCounts = new Map<string, number>();

  // First pass to get total counts
  pawns.value.forEach(pawn => {
    const imageId = pawn.image instanceof File ? pawn.image.name : pawn.image;
    const key = `${imageId}-${pawn.size}`;
    totalCounts.set(key, (totalCounts.get(key) || 0) + 1);
  });

  // Second pass to assign indices and showIndex flag
  pawns.value.forEach(pawn => {
    const imageId = pawn.image instanceof File ? pawn.image.name : pawn.image;
    const key = `${imageId}-${pawn.size}`;
    const count = (counts.get(key) || 0) + 1;
    pawn.index = count;
    pawn.showIndex = (totalCounts.get(key) || 0) > 1;
    pawn.colour = PAWN_COLORS[(count - 1) % PAWN_COLORS.length];
    counts.set(key, count);
  });
};


const calculatePages = () => {
  const padding = paperMargin.value; // mm
  const containerWidth = paperDims.value.width - (padding * 2);
  const containerHeight = paperDims.value.height - (padding * 2);
  const appGapMm = 10 / 96 * 25.4; // 10px in mm approx 2.645mm
  const verticalGapMm = 5 / 96 * 25.4; // 5px gap between rows
  const borderAdjustment = 0.5 / 72 * 25.4 * 2; // 0.5pt border on each side = 1pt total

  const newPages: {
    pawns: Pawn[],
    metadata: Map<string, { isFirstInRow: boolean, isSameSizeAsPrevious: boolean, isLastRow: boolean }>
  }[] = [];
  let currentPagePawns: Pawn[] = [];
  let currentPageMetadata = new Map<string, {
    isFirstInRow: boolean,
    isSameSizeAsPrevious: boolean,
    isLastRow: boolean
  }>();

  let currentRowWidth = 0;
  let currentRowHeight = 0;
  let totalHeightUsed = 0;
  let isFirstRowOnPage = true;
  let pawnsInCurrentRow: string[] = [];

  const finalizePage = () => {
    if (currentPagePawns.length > 0) {
      // Mark pawns in the last row
      pawnsInCurrentRow.forEach(id => {
        const meta = currentPageMetadata.get(id);
        if (meta) meta.isLastRow = true;
      });
      newPages.push({pawns: currentPagePawns, metadata: currentPageMetadata});
    }
  };

  pawns.value.forEach((pawn, index) => {
    const pSize = PAWN_SIZES[pawn.size];
    const width = pSize.width + borderAdjustment;
    const height = (pSize.height * 2) + SPACER_BAR_HEIGHT + borderAdjustment;

    const prevPawn = index > 0 ? pawns.value[index - 1] : null;
    let horizontalGap = appGapMm;
    if (prevPawn && prevPawn.size === pawn.size && currentRowWidth > 0) {
      horizontalGap = 0;
    }
    const effectiveWidth = currentRowWidth === 0 ? width : width + horizontalGap;

    let isFirst = false;
    let isSameSize = false;

    // Check if it fits in current row
    if (currentRowWidth > 0 && currentRowWidth + effectiveWidth > containerWidth + 0.1) {
      // Move to next row
      totalHeightUsed += currentRowHeight + (isFirstRowOnPage ? 0 : verticalGapMm);
      isFirstRowOnPage = false;
      currentRowWidth = 0;
      currentRowHeight = 0;
      isFirst = true;
      pawnsInCurrentRow = [];
    } else if (currentRowWidth === 0) {
      isFirst = true;
    } else {
      isSameSize = prevPawn?.size === pawn.size;
    }

    // Check if it fits in current page
    const rowGapToApply = (isFirstRowOnPage && currentRowWidth === 0) ? 0 : verticalGapMm;
    const heightWithPotentialGap = height + rowGapToApply;

    if (totalHeightUsed + heightWithPotentialGap > containerHeight + 0.1) {
      finalizePage();
      currentPagePawns = [];
      currentPageMetadata = new Map();
      totalHeightUsed = 0;
      currentRowWidth = 0;
      currentRowHeight = 0;
      isFirstRowOnPage = true;
      isFirst = true;
      isSameSize = false;
      pawnsInCurrentRow = [];
    }

    currentPagePawns.push(pawn);
    currentPageMetadata.set(pawn.id, {isFirstInRow: isFirst, isSameSizeAsPrevious: isSameSize, isLastRow: false});
    pawnsInCurrentRow.push(pawn.id);

    let actualHorizontalGap = appGapMm;
    if (currentRowWidth > 0 && prevPawn && prevPawn.size === pawn.size) {
      actualHorizontalGap = 0;
    } else if (currentRowWidth === 0) {
      actualHorizontalGap = 0;
    }

    currentRowWidth += (currentRowWidth === 0 ? width : width + actualHorizontalGap);
    currentRowHeight = Math.max(currentRowHeight, height);
  });

  finalizePage();

  pages.value = newPages.length > 0 ? newPages : [{pawns: [], metadata: new Map()}];
};

watch([pawns, selectedPaperSize, paperMargin], () => {
  updatePawnIndices();
  calculatePages();
}, {deep: true, immediate: true});

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
};

const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  const files = event.dataTransfer?.files;
  if (files) {
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.json')) {
        importState(file);
        return;
      }
      if (file.type.startsWith('image/')) {
        // Check if a pawn with the same file name already exists
        const existingPawn = pawns.value.find(p => {
          if (p.image instanceof File) {
            return p.image.name === file.name;
          }
          return false;
        });

        if (existingPawn) {
          // Use existing size and show count dialog
          pendingFiles.value = [file];
          selectedSize.value = existingPawn.size;
          showCountDialog.value = true;
          // We break here because we can only show one dialog at a time
          return;
        } else {
          newFiles.push(file);
        }
      }
    }
    if (newFiles.length > 0) {
      pendingFiles.value = newFiles;
      showSizeDialog.value = true;
    }
  }
};

const selectSize = (size: PawnSize) => {
  selectedSize.value = size;
  showSizeDialog.value = false;
  showCountDialog.value = true;
};

const confirmCount = (count: number) => {
  if (selectedSize.value) {
    const size = selectedSize.value;
    pendingFiles.value.forEach(file => {
      for (let i = 0; i < count; i++) {
        const newPawn = new Pawn(file, file.name, size);
        pawns.value.push(newPawn);
      }
    });
  }
  pendingFiles.value = [];
  selectedSize.value = null;
  showCountDialog.value = false;
};

const cancelDialog = () => {
  pendingFiles.value = [];
  selectedSize.value = null;
  showSizeDialog.value = false;
  showCountDialog.value = false;
};

const print = () => {
  window.print();
};

const removePawn = (pawn: Pawn) => {
  const index = pawns.value.indexOf(pawn);
  if (index > -1) {
    pawns.value.splice(index, 1);
  }
};

const isSameImage = (image1: string | File, image2: string | File) => {
  if (typeof image1 === 'string' && typeof image2 === 'string') {
    return image1 === image2;
  }
  if (image1 instanceof File && image2 instanceof File) {
    return image1.name === image2.name && image1.size === image2.size;
  }
  return false;
};

const removeAllWithImage = (targetPawn: Pawn) => {
  pawns.value = pawns.value.filter(p => !isSameImage(p.image, targetPawn.image));
};

const updatePawn = (targetPawn: Pawn, data: { crop: { x: number, y: number, scale: number }, size: PawnSize }) => {
  const oldSize = targetPawn.size;
  const oldImage = targetPawn.image;

  pawns.value.forEach(pawn => {
    if (pawn.size === oldSize && isSameImage(pawn.image, oldImage)) {
      pawn.crop = {...data.crop};
      pawn.size = data.size;
    }
  });
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const exportState = async () => {
  const images: Record<string, { name: string, type: string, data: string }> = {};
  const imageMap = new Map<File | string, string>();

  // Synchronously identify all unique images and assign keys to avoid race conditions
  let imgCount = 0;
  pawns.value.forEach(pawn => {
    if (pawn.image instanceof File && !imageMap.has(pawn.image)) {
      const imageKey = `img_${imgCount++}`;
      imageMap.set(pawn.image, imageKey);
    }
  });

  // Now perform the async Base64 conversion for each unique image
  await Promise.all(
    Array.from(imageMap.entries()).map(async ([file, key]) => {
      if (file instanceof File) {
        images[key] = {
          name: file.name,
          type: file.type,
          data: await fileToBase64(file)
        };
      }
    })
  );

  const exportedPawns = pawns.value.map((pawn) => {
    let imageKey: string;
    if (pawn.image instanceof File) {
      imageKey = imageMap.get(pawn.image)!;
    } else {
      imageKey = pawn.image;
    }

    return {
      ...pawn,
      image: imageKey
    };
  });

  const state = {
    pawns: exportedPawns,
    images: images,
    settings: {
      selectedPaperSize: selectedPaperSize.value,
      paperMargin: paperMargin.value
    }
  };

  const blob = new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pawns-state-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const base64ToFile = (base64Data: string, filename: string, mimeType: string) => {
  const arr = base64Data.split(',');
  const match = arr[0].match(/:(.*?);/);
  const mime = match ? match[1] : mimeType;
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type: mime});
};

const importState = async (file: File) => {
  try {
    const text = await file.text();
    const state = JSON.parse(text);

    if (state.settings) {
      selectedPaperSize.value = state.settings.selectedPaperSize || 'A4';
      paperMargin.value = state.settings.paperMargin || 5;
    }

    const reconstructedImages = new Map<string, File>();
    if (state.images) {
      for (const [key, imgData] of Object.entries(state.images) as [string, any][]) {
        reconstructedImages.set(key, base64ToFile(imgData.data, imgData.name, imgData.type));
      }
    }

    if (Array.isArray(state.pawns)) {
      pawns.value = state.pawns.map((p: any) => {
        let image = p.image;
        // Check if it's a key in our images map
        if (typeof p.image === 'string' && reconstructedImages.has(p.image)) {
          image = reconstructedImages.get(p.image);
        } else if (p.image && typeof p.image === 'object' && p.image.data) {
          // Fallback for old format
          image = base64ToFile(p.image.data, p.image.name, p.image.type);
        }
        const pawn = new Pawn(image, p.name, p.size, p.colour, p.crop, p.index, p.showIndex);
        pawn.id = p.id || pawn.id;
        return pawn;
      });
    }
  } catch (e) {
    console.error('Failed to import state:', e);
    alert('Failed to import state. Please make sure the file is a valid JSON export.');
  }
};
</script>

<template>
  <div
      class="app-container"
      @dragover="handleDragOver"
      @drop="handleDrop"
  >
    <header v-if="!showSizeDialog" class="no-print">
      <div class="wrapper">
        <h1>Token wrap creator</h1>
        <div>Drag images into the page to add pawns. Double click a pawn to edit. Print with no scaling to use as wraps
          around existing Paizo pawns. Set margins to 'none' in print dialogue to ensure correct sizing.
        </div>
        <div>Use the save button to export a JSON file containing all pawns, you can drag this file back onto the page
          to import.</div>
        <div>Hacked together in a couple of hours by <a href="https://github.com/tomoinn">Tom Oinn</a>, 30th May 2026.
          Released on <a href="https://github.com/tomoinn/token-wrap-generator">GitHub</a> under the ASL 2.0 license.
        </div>
      </div>
    </header>

    <div v-if="showSizeDialog" class="modal-overlay">
      <div class="modal-content">
        <h2>Select Pawn Size</h2>
        <div class="size-buttons">
          <button
              v-for="(details, size) in PAWN_SIZES"
              :key="size"
              class="size-button"
              @click="selectSize(size as PawnSize)"
          >
            <span class="size-name">{{ size }}</span>
            <span class="size-dims">{{ details.width }} x {{ details.height }} mm</span>
          </button>
        </div>
        <button class="cancel-button" @click="cancelDialog">Cancel</button>
      </div>
    </div>

    <div v-if="showCountDialog" class="modal-overlay">
      <div class="modal-content">
        <h2>Select Number of Copies</h2>
        <div class="count-buttons">
          <button
              v-for="n in 10"
              :key="n"
              :style="{ backgroundColor: PAWN_COLORS[n-1], color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }"
              class="count-button"
              @click="confirmCount(n)"
          >
            {{ n }}
          </button>
        </div>
        <button class="cancel-button" @click="cancelDialog">Cancel</button>
      </div>
    </div>

    <main>
      <div class="actions no-print">
        <div class="paper-selector">
          <label for="paper-size">Paper&nbsp;Size:</label>
          <select id="paper-size" v-model="selectedPaperSize">
            <option v-for="(dims, key) in PAPER_SIZES" :key="key" :value="key">
              {{ dims.name }} ({{ dims.width }}x{{ dims.height }}mm)
            </option>
          </select>
          <label class="margin-input-label" for="paper-margin">Margin&nbsp;(mm):</label>
          <input
              id="paper-margin"
              v-model.number="paperMargin"
              class="margin-input"
              max="50"
              min="0"
              type="number"
          />
        </div>
        <button @click="exportState">Save</button>
        <button @click="print">Print</button>
      </div>
      <div class="pages-container">
        <div v-for="(page, pageIndex) in pages" :key="pageIndex" :style="{ width: paperDims.width + 'mm', height: paperDims.height + 'mm' }"
             class="page-container">
          <div :style="{ padding: paperMargin + 'mm' }" class="pawn-list">
            <PawnView
                v-for="(pawn, pawnIndex) in page.pawns"
                :key="pawn.id || pawnIndex"
                :class="{
                'same-size-as-previous': page.metadata.get(pawn.id)?.isSameSizeAsPrevious,
                'first-in-row': page.metadata.get(pawn.id)?.isFirstInRow,
                'last-row': page.metadata.get(pawn.id)?.isLastRow
              }"
                :pawn="pawn"
                @remove="removePawn(pawn)"
                @update="(data) => updatePawn(pawn, data)"
                @remove-all="removeAllWithImage(pawn)"
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  padding: 2rem;
  display: flex;
  flex-direction: column;
}

header {
  line-height: 1.5;
  margin-bottom: 2rem;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

.margin-input-label {
  margin-left: 15px;
}

.pawn-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: flex-start;
  align-content: flex-start;
  box-sizing: border-box;
  width: 100% !important;
}

.pawn-container + .pawn-container {
  margin-left: 10px;
}

.pawn-list > * {
  margin-bottom: 5px;
}

.pawn-container.same-size-as-previous {
  margin-left: -1px;
}

.pawn-container.first-in-row {
  margin-left: 0;
}

.page-container {
  padding: 0;
  margin: 0 auto 20mm;
  background: white;
  border: 1px solid #ccc;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  overflow: hidden;
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


.actions {
  display: flex;
  justify-content: left;
  margin-bottom: 2rem;
  gap: 1rem;
}

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
  z-index: 1000;
}

.wrapper > div {
  margin-top: 8px;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  max-width: 90%;
  width: 400px;
  text-align: center;
}

.modal-content h2 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.modal-content p {
  margin-bottom: 1.5rem;
  color: #666;
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

.size-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.size-button {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  height: auto;
  line-height: 1.2;
}

.size-name {
  font-weight: bold;
  text-transform: capitalize;
  font-size: 1.1rem;
}

.size-dims {
  font-size: 0.8rem;
  opacity: 0.9;
  margin-top: 0.25rem;
}

.cancel-button {
  background-color: #e74c3c;
  margin-top: 0.5rem;
}

.cancel-button:hover {
  background-color: #c0392b;
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

.actions {
  margin-top: 10px;
  display: flex;
  gap: 1rem;
}

@media print {
  @page {
    margin: 0;
    size: auto;
  }

  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    display: block !important;
    overflow: visible !important;
    background: white !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  #app {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    display: block !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    transform: none !important;
  }

  body * {
    visibility: hidden;
  }

  #app, #app * {
    visibility: visible;
  }

  .pages-container, .pages-container * {
    visibility: visible !important;
  }

  header {
    display: none !important;
  }

  .actions {
    display: none !important;
  }

  .app-container {
    padding: 0 !important;
    margin: 0 !important;
    display: block !important;
    min-height: auto !important;
  }

  main {
    padding: 0 !important;
    margin: 0 !important;
    display: block !important;
  }

  .pages-container {
    padding: 0 !important;
    margin: 0 !important;
    display: block !important;
    width: 100% !important;
  }

  .page-container {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    border: none !important;
    box-shadow: none !important;
    margin: 0 !important;
    background: white !important;
    visibility: visible !important;
    page-break-after: always !important;
    break-after: page !important;
    overflow: hidden !important;
    display: block !important;
    -webkit-region-break-inside: avoid;
  }

  .page-container * {
    visibility: visible !important;
  }

  .no-print {
    display: none !important;
  }

  .pawn-list {
    display: block !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    width: 100% !important;
    font-size: 0; /* Remove space between inline-flex elements if any */
    text-align: left !important;
    transform: none !important;
  }

  .pawn-container {
    display: inline-flex !important;
    vertical-align: top;
    font-size: 1rem; /* Reset font-size */
    margin-left: 10px !important;
  }

  .pawn-container:not(.last-row) {
    margin-bottom: 5px !important;
  }

  .pawn-container.same-size-as-previous {
    margin-left: -1px !important;
  }

  .pawn-container.first-in-row {
    margin-left: 0 !important;
  }
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
