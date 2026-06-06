<script lang="ts" setup>
import {computed, ref, watch} from 'vue';
import {Pawn} from './models/Pawn';
import {PAPER_SIZES, type PaperSize, PAWN_COLORS, PAWN_SIZES, type PawnSize,} from './models/Settings';
import PawnView from './components/PawnView.vue';
import ActionBar from './components/ActionBar.vue';
import {calculatePages, type Page} from './utils/pageCalculator';
import {exportToSVG as exportToSVGUtil} from './utils/svgExporter';
import {exportState as exportStateUtil, importState as importStateUtil} from './utils/stateManager';

const pawns = ref<Pawn[]>([]);
const pages = ref<Page[]>([]);
const pendingImages = ref<(File | string)[]>([]);
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


const calculatePagesInternal = () => {
  pages.value = calculatePages(
      pawns.value,
      paperDims.value.width,
      paperDims.value.height,
      paperMargin.value
  );
};

watch([pawns, selectedPaperSize, paperMargin], () => {
  updatePawnIndices();
  calculatePagesInternal();
}, {deep: true, immediate: true});

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
};

const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return;

  const files = dataTransfer.files;
  const newImages: (File | string)[] = [];

  // Check for files first (local drag)
  if (files && files.length > 0) {
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
          pendingImages.value = [file];
          selectedSize.value = existingPawn.size;
          showCountDialog.value = true;
          return;
        } else {
          newImages.push(file);
        }
      }
    }
  } else {
    // Check for dragged images from other web pages
    const html = dataTransfer.getData('text/html');
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const img = doc.querySelector('img');
      if (img && img.src) {
        newImages.push(img.src);
      }
    }

    if (newImages.length === 0) {
      const uriList = dataTransfer.getData('text/uri-list');
      if (uriList) {
        const uris = uriList.split('\n').filter(uri => uri.trim() && !uri.startsWith('#'));
        for (const uri of uris) {
          // Basic check if it's an image URL
          if (uri.match(/\.(jpeg|jpg|gif|png|webp|svg|avif)(\?.*)?$/i)) {
            newImages.push(uri);
          }
        }
      }
    }
  }

  if (newImages.length > 0) {
    pendingImages.value = newImages;
    showSizeDialog.value = true;
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
    pendingImages.value.forEach(item => {
      const name = item instanceof File ? item.name : 'Remote Image';
      for (let i = 0; i < count; i++) {
        const newPawn = new Pawn(item, name, size);
        pawns.value.push(newPawn);
      }
    });
  }
  pendingImages.value = [];
  selectedSize.value = null;
  showCountDialog.value = false;
};

const cancelDialog = () => {
  pendingImages.value = [];
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

const exportToSVG = () => {
  exportToSVGUtil(
      pawns.value,
      pages.value,
      paperDims.value.width,
      paperDims.value.height
  );
};

const exportState = async () => {
  await exportStateUtil(
      pawns.value,
      selectedPaperSize.value,
      paperMargin.value
  );
};

const importState = async (file: File) => {
  try {
    const result = await importStateUtil(file);
    if (result) {
      selectedPaperSize.value = result.settings.selectedPaperSize;
      paperMargin.value = result.settings.paperMargin;
      pawns.value = result.pawns;
    }
  } catch (e: any) {
    alert(e.message);
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
        <div>Drag images into the page (from your computer or another web page) to add pawns. Double click a pawn to
          edit. Print with no scaling to use as wraps
          around existing Paizo pawns. Set margins to 'none' in print dialogue to ensure the margins you set here are
          respected.
        </div>
        <div>Use the save button to export a JSON file containing all pawns, you can drag this file back onto the page
          to import.
        </div>
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
      <ActionBar
          v-model:paper-margin="paperMargin"
          v-model:paper-size="selectedPaperSize"
          @print="print"
          @export-state="exportState"
          @export-to-s-v-g="exportToSVG"
      />
      <div class="pages-container">
        <div v-for="(page, pageIndex) in pages" :key="pageIndex"
             :style="{ width: paperDims.width + 'mm', height: paperDims.height + 'mm' }"
             class="page-container">
          <div :style="{ padding: paperMargin + 'mm', width: paperDims.width + 'mm', height: paperDims.height + 'mm' }"
               class="pawn-list">
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


@media print {
  @page {
    margin: 0;
  }

  /* Reset everything broadly first */
  html, body, #app, .app-container, main, .pages-container, .page-container {
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    max-width: none !important;
    min-width: 0 !important;
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    display: block !important;
    position: static !important;
    float: none !important;
    transform: none !important;
  }

  .pawn-list {
    /* Ensure inline padding is not overridden by global resets */
  }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  html, body {
    background: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    overflow: visible !important;
  }

  #app {
    width: 100% !important;
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
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
  }

  .page-container {
    position: relative !important;
    top: 0 !important;
    left: 0 !important;
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    background: white !important;
    visibility: visible !important;
    page-break-after: always !important;
    break-after: page !important;
    overflow: visible !important;
    -webkit-region-break-inside: avoid;
    clear: both !important;
    float: none !important;
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
    /* padding is set via inline style to paperMargin */
    box-sizing: border-box !important;
    font-size: 0;
    text-align: left !important;
    transform: none !important;
    width: 100% !important;
    height: 100% !important;
    visibility: visible !important;
    /* Prevent margin collapse with first child */
    outline: 0.1px solid transparent !important;
  }

  .pawn-container {
    display: inline-flex !important;
    vertical-align: top;
    font-size: 1rem; /* Reset font-size */
  }

  .pawn-container + .pawn-container {
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
