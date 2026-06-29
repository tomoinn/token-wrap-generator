<script lang="ts" setup>
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {Pawn} from './models/Pawn';
import {PAPER_SIZES, type PaperSize, PAWN_COLORS, PAWN_SIZES, type PawnSize,} from './models/Settings';
import PawnView from './components/PawnView.vue';
import ActionBar from './components/ActionBar.vue';
import CountModal from './components/CountModal.vue';
import AboutModal from './components/AboutModal.vue';
import {calculatePages, type Page} from './utils/pageCalculator';
import {exportToSVG as exportToSVGUtil} from './utils/svgExporter';
import {
  exportState as exportStateUtil,
  importState as importStateUtil,
  importStateFromUrl as importStateFromUrlUtil
} from './utils/stateManager';
import type {ExtractedPdfImage} from './utils/pdfImageExtractor';

import {resizeImageIfNeeded} from '@/utils/imageResizer';

type PdfImportImage = ExtractedPdfImage & { selected: boolean; size: PawnSize; count: number };

const pawns = ref<Pawn[]>([]);
const pages = ref<Page[]>([]);
const pendingImages = ref<(File | string)[]>([]);
const pdfExtractedImages = ref<PdfImportImage[]>([]);
const selectedSize = ref<PawnSize | null>(null);
const dropTargetPawn = ref<Pawn | null>(null);
const showPdfImportDialog = ref(false);
const isImportingPdf = ref(false);
const showSizeDialog = ref(false);
const showCountDialog = ref(false);
const showAboutDialog = ref(false);
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

    // Find the starting color index for this group from the first pawn
    const firstPawnInGroup = pawns.value.find(p => {
      const pId = p.image instanceof File ? p.image.name : p.image;
      return pId === imageId && p.size === pawn.size;
    });
    const startIdx = firstPawnInGroup?.startColourIndex || 0;

    pawn.colour = PAWN_COLORS[(startIdx + count - 1) % PAWN_COLORS.length];
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

const closePdfImportDialog = () => {
  pdfExtractedImages.value.forEach(image => URL.revokeObjectURL(image.previewUrl));
  pdfExtractedImages.value = [];
  showPdfImportDialog.value = false;
};

const togglePdfImageSelection = (imageId: string) => {
  const image = pdfExtractedImages.value.find(item => item.id === imageId);
  if (image) {
    image.selected = !image.selected;
  }
};

const selectAllPdfImages = () => {
  pdfExtractedImages.value.forEach(img => img.selected = true);
};

const deselectAllPdfImages = () => {
  pdfExtractedImages.value.forEach(img => img.selected = false);
};

const setAllPdfImageSizes = (size: PawnSize) => {
  pdfExtractedImages.value.forEach(img => img.size = size);
};

const setAllPdfImageCounts = (count: number) => {
  pdfExtractedImages.value.forEach(img => img.count = count);
};

const confirmPdfImageSelection = async () => {
  const selected = pdfExtractedImages.value.filter(image => image.selected);
  console.info('[PDF Import] User confirmed image selection', {
    selectedCount: selected.length,
    totalExtractedCount: pdfExtractedImages.value.length
  });
  if (selected.length === 0) {
    alert('Select at least one image to import.');
    return;
  }

  for (const item of selected) {
    const resizedItem = await resizeImageIfNeeded(item.file);
    const name = item.name;
    for (let i = 0; i < item.count; i++) {
      const newPawn = new Pawn(resizedItem, name, item.size);
      pawns.value.push(newPawn);
    }
  }

  closePdfImportDialog();
};

const handleDrop = async (event: DragEvent) => {
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
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          isImportingPdf.value = true;
          console.info('[PDF Import] PDF detected in drop event', {
            fileName: file.name,
            fileType: file.type,
            fileSizeBytes: file.size
          });
          const { extractImagesFromPdfFile } = await import('./utils/pdfImageExtractor');
          const extractedImages = await extractImagesFromPdfFile(file);
          console.info('[PDF Import] PDF extraction completed', {
            fileName: file.name,
            extractedImageCount: extractedImages.length
          });
          if (extractedImages.length === 0) {
            console.warn('[PDF Import] No extractable images found', {
              fileName: file.name
            });
            alert('No extractable images were found in this PDF.');
            return;
          }
          pdfExtractedImages.value = extractedImages
            .map(image => ({...image, selected: false, size: 'medium' as PawnSize, count: 1}))
            .sort((a, b) => b.file.size - a.file.size);
          console.info('[PDF Import] Opening PDF import dialog', {
            extractedImageCount: pdfExtractedImages.value.length
          });
          showPdfImportDialog.value = true;
        } catch (e: any) {
          console.error('[PDF Import] Failed to import PDF', {
            fileName: file.name,
            error: e
          });
          alert(`Failed to import PDF: ${e?.message || 'Unknown error'}`);
        } finally {
          isImportingPdf.value = false;
        }
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
          dropTargetPawn.value = existingPawn;
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

const confirmCount = async (count: number) => {
  if (selectedSize.value) {
    const size = selectedSize.value;
    let insertionIndex = dropTargetPawn.value ? pawns.value.indexOf(dropTargetPawn.value) : -1;

    for (const item of pendingImages.value) {
      const resizedItem = await resizeImageIfNeeded(item);
      const name = item instanceof File ? item.name : 'Remote Image';
      const newPawnsForThisItem: Pawn[] = [];
      for (let i = 0; i < count; i++) {
        const newPawn = new Pawn(resizedItem, name, size);
        newPawnsForThisItem.push(newPawn);
      }

      if (insertionIndex !== -1) {
        pawns.value.splice(insertionIndex + 1, 0, ...newPawnsForThisItem);
        insertionIndex += newPawnsForThisItem.length;
      } else {
        pawns.value.push(...newPawnsForThisItem);
      }
    }
  }
  pendingImages.value = [];
  selectedSize.value = null;
  dropTargetPawn.value = null;
  showCountDialog.value = false;
};

const cancelDialog = () => {
  pendingImages.value = [];
  selectedSize.value = null;
  dropTargetPawn.value = null;
  closePdfImportDialog();
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

const updatePawn = (targetPawn: Pawn, data: { crop: { x: number, y: number, scale: number }, size: PawnSize, pawnName: string, startColourIndex: number }) => {
  const oldSize = targetPawn.size;
  const oldImage = targetPawn.image;

  pawns.value.forEach(pawn => {
    if (pawn.size === oldSize && isSameImage(pawn.image, oldImage)) {
      pawn.crop = {...data.crop};
      pawn.size = data.size;
      pawn.pawnName = data.pawnName;
      pawn.startColourIndex = data.startColourIndex;
    }
  });
};

const addCopiesOfPawn = (targetPawn: Pawn, data: { crop: { x: number, y: number, scale: number }, size: PawnSize, pawnName: string, startColourIndex: number }, count: number) => {
  const index = pawns.value.indexOf(targetPawn);
  const newPawns: Pawn[] = [];
  for (let i = 0; i < count; i++) {
    const newPawn = new Pawn(targetPawn.image, targetPawn.name, data.size);
    newPawn.crop = {...data.crop};
    newPawn.pawnName = data.pawnName;
    newPawn.startColourIndex = data.startColourIndex;
    newPawns.push(newPawn);
  }

  if (index !== -1) {
    pawns.value.splice(index + 1, 0, ...newPawns);
  } else {
    pawns.value.push(...newPawns);
  }
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

onMounted(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const url = urlParams.get('url');
  if (url) {
    try {
      const result = await importStateFromUrlUtil(url);
      if (result) {
        selectedPaperSize.value = result.settings.selectedPaperSize;
        paperMargin.value = result.settings.paperMargin;
        pawns.value = result.pawns;
      }
    } catch (e: any) {
      alert(e.message);
    }
  }
});

onBeforeUnmount(() => {
  closePdfImportDialog();
});
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
          respected. Click <a href="?url=raiding_party.json">here</a> to load a goblin raiding party...
        </div>
        <div>Drag a PDF file to the canvas to extract images and create pawns directly.</div>
        <div>Use the save button to export a JSON file containing all pawns, you can drag this file back onto the page
          to import. Any images dragged in from files are included directly in the JSON file, images from other web
          pages are referenced (so ensure those other pages are available when you load). Please consider copyright
          when sharing e.g. pawns from society scenarios.
        </div>
        <div>Hacked together by <a href="https://github.com/tomoinn">Tom Oinn</a>, this version 29th June 2026.
          Released on <a href="https://github.com/tomoinn/token-wrap-generator">GitHub</a> under the ASL 2.0 license.
          Uses <a href="#" @click.prevent="showAboutDialog = true">these</a> excellent open source libraries.
        </div>
      </div>
    </header>

    <div v-if="showPdfImportDialog" class="modal-overlay">
      <div class="modal-content pdf-modal-content">
        <h2>Select Images From PDF</h2>

        <div class="pdf-bulk-actions">
          <div class="bulk-group">
            <button class="secondary small" @click="selectAllPdfImages">Select All</button>
            <button class="secondary small" @click="deselectAllPdfImages">Deselect All</button>
          </div>
          <div class="bulk-group">
            <span>Set all to:</span>
            <select @change="(e) => setAllPdfImageSizes((e.target as HTMLSelectElement).value as PawnSize)">
              <option v-for="(details, size) in PAWN_SIZES" :key="size" :value="size" :selected="size === 'medium'">{{ size }}</option>
            </select>
            <input type="number" min="1" max="99" value="1" style="width: 50px" @change="(e) => setAllPdfImageCounts(parseInt((e.target as HTMLInputElement).value))">
          </div>
        </div>

        <div class="pdf-grid">
          <div v-for="image in pdfExtractedImages" :key="image.id" class="pdf-item" :class="{ 'pdf-item-selected': image.selected }">
            <div class="pdf-item-header">
              <input type="checkbox" v-model="image.selected">
              <span class="pdf-image-name">{{ image.name }}</span>
            </div>
            <img :src="image.previewUrl" :alt="image.name" class="pdf-preview-image" @click="image.selected = !image.selected">
            <div class="pdf-item-controls">
              <select v-model="image.size" :disabled="!image.selected">
                <option v-for="(details, size) in PAWN_SIZES" :key="size" :value="size">{{ size }}</option>
              </select>
              <div class="count-control">
                <label>Copies:</label>
                <input type="number" v-model.number="image.count" min="1" max="99" :disabled="!image.selected">
              </div>
            </div>
          </div>
        </div>
        <div class="pdf-actions">
          <button class="primary" @click="confirmPdfImageSelection">Add Selected</button>
          <button class="danger" @click="closePdfImportDialog">Cancel</button>
        </div>
      </div>
    </div>

    <div v-if="isImportingPdf" class="modal-overlay">
      <div class="modal-content loading-modal">
        <div class="spinner"></div>
        <h2>Extracting images from PDF...</h2>
        <p>This may take a few moments depending on the file size.</p>
      </div>
    </div>

    <div v-if="showSizeDialog" class="modal-overlay">
      <div class="modal-content">
        <h2>Select Pawn Size</h2>
        <div class="size-buttons">
          <button
              v-for="(details, size) in PAWN_SIZES"
              :key="size"
              class="primary size-button"
              @click="selectSize(size as PawnSize)"
          >
            <span class="size-name">{{ size }}</span>
            <span class="size-dims">{{ details.width }} x {{ details.height }} mm</span>
          </button>
        </div>
        <button class="danger cancel-button" @click="cancelDialog">Cancel</button>
      </div>
    </div>

    <CountModal
        v-if="showCountDialog"
        @select="confirmCount"
        @close="cancelDialog"
    />

    <AboutModal
        v-if="showAboutDialog"
        @close="showAboutDialog = false"
    />

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
                @add-copies="(data, count) => { updatePawn(pawn, data); addCopiesOfPawn(pawn, data, count); }"
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
  margin-top: 0.5rem;
}

.pdf-modal-content {
  width: min(900px, 95vw);
  max-height: 85vh;
  overflow: auto;
}

.pdf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin: 1rem 0 1.5rem;
}

.pdf-item {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  cursor: default;
}

.pdf-item-selected {
  border-color: #007AFF;
  background-color: #f0f7ff;
}

.pdf-item-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.pdf-item-controls {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
}

.count-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.count-control input {
  width: 45px;
}

.pdf-bulk-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f5f5f5;
  border-radius: 6px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.bulk-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pdf-preview-image {
  width: 100%;
  height: 120px;
  object-fit: contain;
  background: #f8f8f8;
  border-radius: 4px;
  cursor: pointer;
}

.pdf-image-name {
  font-size: 0.75rem;
  word-break: break-all;
  text-align: left;
}

.pdf-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}

.loading-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
