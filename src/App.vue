<template>
    <div
        class="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] bg-neutral-900 rounded-2xl shadow-xl p-4"
        id="launcher-wrapper"
    >
        <input
            v-model="query"
            class="w-full bg-neutral-800 text-white rounded-md px-4 py-2 text-xl focus:outline-none cursor-auto"
            placeholder="Digite algo..."
            @input="onInput"
            @keypress.enter.prevent="selectedResult && invokeAction(selectedResult.id)"
            @keydown.arrow-down.prevent="nextResult"
            @keydown.arrow-up.prevent="previousResult"
            ref="input"
        />
        <ul class="mt-4 max-h-72">
            <li
                v-for="(result, index) in results"
                :key="result.id"
                @click="invokeAction(result.id)"
                class="flex flex-row space-x-2 hover:bg-neutral-700 cursor-pointer pointer-events-auto p-2 rounded px-2.5 text-gray-300 hover:text-gray-200"
                :class="{
                    'bg-neutral-700 text-gray-200': selectedResult && selectedResult.id === result.id,
                }"
            >
                <img v-show="result.icon && result.icon.includes('data:image/')" :src="result.icon" class="w-6 h-6" />
                <span v-text="result.title"></span>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from "vue";
import type { SearchResultDTO } from "./interfaces/results";

const query = ref("");
const results = ref<SearchResultDTO[]>([]);
const input = ref<HTMLInputElement | null>(null);
const selectedResult = ref<SearchResultDTO | null>(null);

onMounted(() => {
    resizeWindowToFit();

    if (input.value) {
        input.value.focus();
    }
});

watch(results, () => {
    nextTick(resizeWindowToFit);
});

window.electronAPI.hideMainWindow(resetState);
window.electronAPI.showMainWindow((r) => {
    console.log("showMainWindow:", r);
    input.value?.focus();
    results.value = r;

    if (results.value.length > 0) {
        selectedResult.value = results.value[0];
    } else {
        selectedResult.value = null;
    }
    resizeWindowToFit();
});

function resizeWindowToFit() {
    const el = document.getElementById("launcher-wrapper");
    if (el) {
        const height = el.offsetHeight;
        const padding = results.value.length > 3 ? 120 : 0;
        window.electronAPI.resizeWindow(height + padding);
    }
}

async function invokeAction(resultId: string) {
    console.log("invokeAction:", resultId);
    await window.electronAPI.invokeAction(resultId);
}

async function onInput() {
    console.log("onInput:", query.value);

    results.value = await window.electronAPI.invokeSearch(query.value);

    if (results.value.length > 0) {
        selectedResult.value = results.value[0];
    } else {
        selectedResult.value = null;
    }
}

async function resetState() {
    query.value = "";
    results.value = [];
    resizeWindowToFit();
}

function nextResult() {
    if (results.value.length === 0) return;

    const currentIndex = results.value.findIndex((r) => r.id === selectedResult.value?.id);
    const nextIndex = (currentIndex + 1) % results.value.length;
    selectedResult.value = results.value[nextIndex];
}

function previousResult() {
    if (results.value.length === 0) return;

    const currentIndex = results.value.findIndex((r) => r.id === selectedResult.value?.id);
    const previousIndex = (currentIndex - 1 + results.value.length) % results.value.length;
    selectedResult.value = results.value[previousIndex];
}
</script>
