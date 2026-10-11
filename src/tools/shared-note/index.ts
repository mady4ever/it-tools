import { Notes } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.shared-note.title'),
  path: '/shared-note',
  description: translate('tools.shared-note.description'),
  keywords: ['note', 'snippet', 'json', 'sync', 'share', 'clipboard', 'text', 'devices'],
  component: () => import('./shared-note.vue'),
  icon: Notes,
  createdAt: new Date('2025-01-01'),
});
