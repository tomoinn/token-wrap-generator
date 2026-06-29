<script lang="ts" setup>
const emit = defineEmits<{
  (e: 'close'): void;
}>();

const libraries = [
  {name: 'pdf-parse', version: '2.4.5', license: 'Apache-2.0'},
  {name: 'vue', version: '3.5.35', license: 'MIT'}
];
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <h2>Token Wrap Creator</h2>
      <p>This project uses the following open source libraries, many thanks to their creators and contributors.</p>
      <div class="table-container">
        <table>
          <thead>
          <tr>
            <th>Library</th>
            <th>Version</th>
            <th>License</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="lib in libraries" :key="lib.name">
            <td class="lib-name">{{ lib.name }}</td>
            <td>{{ lib.version }}</td>
            <td>{{ lib.license }}</td>
          </tr>
          </tbody>
        </table>
      </div>
      <button class="primary" @click="emit('close')">Close</button>
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
  z-index: 1200;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  max-width: 95%;
  width: 500px;
  text-align: center;
  color: #333;
}

.modal-content h2 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.modal-content h3 {
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
  text-align: left;
}

.table-container {
  margin: 1rem 0;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

th, td {
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
}

th {
  background-color: #f8f9fa;
  font-weight: bold;
}

.lib-name {
  font-family: monospace;
  font-weight: bold;
}

.footer-note {
  margin-top: 1.5rem;
  font-size: 0.9rem;
}

.primary {
  margin-top: 1rem;
}

a {
  color: hsla(160, 100%, 37%, 1);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>
