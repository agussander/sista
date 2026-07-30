/**
 * El template de mail vive en `static/assets/correo_template.html` porque lo
 * comparte con los handlers PHP del build estatico. Se importa con `?raw` para
 * que Vite lo inline en el bundle: leerlo del disco en runtime dependeria del
 * cwd del proceso, que en Hostinger no es la raiz del repo.
 */
import templateHtml from '../../../static/assets/correo_template.html?raw';

export { templateHtml };
