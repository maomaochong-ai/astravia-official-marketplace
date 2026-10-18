/**
 * The pdf.js worker as a build asset.
 *
 * Kept in its own module so the URL import is evaluated only when a PDF is
 * actually parsed; `?url` is Vite's supported way to emit the worker file next
 * to the plugin bundle.
 */
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export default workerUrl;
