import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createHead } from '@vueuse/head';

import shadow from 'vue-shadow-dom';
import { installAsendmeBridge } from './asendme-bridge';

import 'virtual:uno.css';
import './asendme.css';

import { naive } from './plugins/naive.plugin';

import App from './App.vue';
import router from './router';
import { i18nPlugin } from './plugins/i18n.plugin';

installAsendmeBridge();

const app = createApp(App);

app.use(createPinia());
app.use(createHead());
app.use(i18nPlugin);
app.use(router);
app.use(naive);
app.use(shadow);

app.mount('#app');
