// app/modules/document-engine/index.js
export { createSchoolIdentityProvider } from "./school-identity-provider.js";
export { createDocumentNumberingService } from "./document-numbering-service.js";
export { renderDocumentHeader } from "./document-header.js";
export { renderDocumentFooter } from "./document-footer.js";
export * from "./identity-blocks.js";
export { renderPaymentBlock } from "./payment-block.js";
export { renderSignatureBlock } from "./signature-block.js";
export { renderQRBlock } from "./qr-block.js";
export { drawDataTable } from "./data-table.js";
export * from "./print-layout.js";
export { renderReceipt } from "./templates/receipt-template.js";
