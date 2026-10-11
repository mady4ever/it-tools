import { Files } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.pdf-merger.title'),
  path: '/pdf-merger',
  description: translate('tools.pdf-merger.description'),
  keywords: ['pdf', 'merge', 'combine', 'join', 'documents', 'photos', 'images'],
  component: () => import('./pdf-merger.vue'),
  icon: Files,
  createdAt: new Date('2025-01-01'),
});
