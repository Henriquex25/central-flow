<template>
    <div
        class="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] bg-neutral-900 rounded-2xl shadow-xl p-4"
        id="launcher-wrapper"
    >
        <input
            v-model="query"
            @input="onInput"
            class="w-full bg-neutral-800 text-white rounded-md px-4 py-2 text-xl focus:outline-none cursor-auto"
            placeholder="Digite algo..."
        />
        <ul class="mt-4 max-h-72 overflow-y-auto">
            <li
                v-for="(result, index) in results"
                :key="result.id"
                @click="invokeAction(result.id)"
                @keypress.enter.prevent="invokeAction(result.id)"
                class="hover:bg-neutral-700 cursor-pointer pointer-events-auto p-2 rounded px-2.5 text-gray-300 hover:text-gray-200 focus:text-gray-200"
            >
                <span v-show="result.icon" v-text="result.icon"></span>
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

onMounted(() => {
    resizeWindowToFit();
});

watch(results, () => {
    nextTick(resizeWindowToFit);
});

function resizeWindowToFit() {
    const el = document.getElementById("launcher-wrapper");
    if (el) {
        const height = el.offsetHeight;
        window.electronAPI.resizeWindow(height);
    }
}

async function invokeAction(resultId: string) {
    console.log("invokeAction:", resultId);
    await window.electronAPI.invokeAction(resultId);
}

async function onInput() {
    console.log("onInput:", query.value);

    results.value = await window.electronAPI.invokeSearch(query.value);
}
</script>
