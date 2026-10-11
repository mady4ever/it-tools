import { Photo } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.image-optimizer.title'),
  path: '/image-optimizer',
  description: translate('tools.image-optimizer.description'),
  keywords: ['image', 'photo', 'compress', 'resize', 'convert', 'jpeg', 'webp', 'png', 'exif', 'metadata', 'strip', 'optimize'],
  component: () => import('./image-optimizer.vue'),
  icon: Photo,
  createdAt: new Date('2025-01-01'),
});
