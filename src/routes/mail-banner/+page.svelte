<svelte:head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width,initial-scale=1" />
	<title>Banner para mail</title>
</svelte:head>

<script>
	let nombre = '';
	let puesto = '';
	let telIconUrl = 'https://sista.com.ar/assets/mail-assets/tel.png';
	let whatsappIconUrl = 'https://sista.com.ar/assets/mail-assets/whatsapp.png';
	let logoUrl = 'https://sista.com.ar/assets/mail-assets/logo.png';

	function escapeHtml(str) {
		return String(str)
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	function buildBannerHtml({ nombre, puesto, telIconUrl, whatsappIconUrl }) {
		const displayNombre = String(nombre ?? '').trim() || 'NOMBRE APELLIDO';
		const displayPuesto = String(puesto ?? '').trim();

		const safeNombre = escapeHtml(displayNombre).toUpperCase();
		const safePuesto = escapeHtml(displayPuesto).toUpperCase();
		const safeTelIconUrl = escapeHtml(telIconUrl);
		const safeWhatsappIconUrl = escapeHtml(whatsappIconUrl);
		const safeLogoUrl = escapeHtml(logoUrl);

		const puestoBlock = displayPuesto
			? `<div style="font-size:14px;color:#E72B65;margin-top:4px;">${safePuesto}</div>`
			: '';

		return `<!-- EMAIL BANNER / SIGNATURE (600px desktop, stacked on mobile) -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;background:#ffffff;">
  <tr>
    <td align="left" style="padding:24px 0 0 0;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="padding:18px 0 12px 0;background:#ffffff;">
            <div style="font-family:'nexa',Arial,Helvetica,sans-serif;line-height:1.1;">
              <div style="font-size:22px;color:#66257c;">
                <strong>${safeNombre}</strong>
              </div>
              ${puestoBlock}
            </div>
          </td>
        </tr>

        <!-- Phones line -->
        <tr>
          <td style="padding:0 0 14px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
              <tr>
                <!-- Tel -->
                <td valign="middle" style="padding:0;mso-line-height-rule:exactly;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                    <tr>
                      <td width="16" valign="middle" style="width:16px;padding:0;line-height:0;font-size:0;">
                        <a href="tel:+542216442600" style="display:block;text-decoration:none;">
                          <img src="${safeTelIconUrl}" width="16" height="16" alt="Teléfono" style="display:block;border:0;outline:none;text-decoration:none;" />
                        </a>
                      </td>
                      <td valign="middle" style="padding:0 0 0 6px;font-family:'nexa',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.35;color:#1b2430;mso-line-height-rule:exactly;white-space:nowrap;">
                        <strong>TEL./FAX:</strong>
                        <a href="tel:+542216442600" style="font-family:'nexa',Arial,Helvetica,sans-serif;color:#66257c;text-decoration:none;white-space:nowrap;">0221-6442600</a>
                      </td>
                    </tr>
                  </table>
                </td>

                <!-- Separator -->
                <td valign="middle" style="padding:0 10px;font-family:'nexa',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.35;color:#66257c;mso-line-height-rule:exactly;">
                  |
                </td>

                <!-- WhatsApp -->
                <td valign="middle" style="padding:0;mso-line-height-rule:exactly;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                    <tr>
                      <td width="16" valign="middle" style="width:16px;padding:0;line-height:0;font-size:0;">
                        <a href="https://wa.me/5492213541906" style="display:block;text-decoration:none;">
                          <img src="${safeWhatsappIconUrl}" width="16" height="16" alt="WhatsApp" style="display:block;border:0;outline:none;text-decoration:none;" />
                        </a>
                      </td>
                      <td valign="middle" style="padding:0 0 0 6px;font-family:'nexa',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.35;color:#1b2430;mso-line-height-rule:exactly;white-space:nowrap;">
                        <strong>WhatsApp:</strong>
                        <a href="https://wa.me/5492213541906" style="font-family:'nexa',Arial,Helvetica,sans-serif;color:#66257c;text-decoration:none;white-space:nowrap;">221-3541906</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Two columns -->
        <tr>
          <td style="padding:0 0 18px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;">
              <tr>
                <!-- Left: hours -->
                <td width="220" valign="top" style="width:220px;padding:0 18px 0 0;">
                  <div style="font-family:'nexa',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#1b2430;">
                    <div style="color:#66257c;margin-bottom:6px;">
                      <strong>Horario de Atención</strong>
                    </div>
                    <div>Lunes a Viernes: 9:00 a 17:00</div>
                    <div style="margin-top:6px;">Sábados: 9:00 a 12:00</div>
                  </div>
                </td>

                <!-- Right: address -->
                <td width="360" valign="top" style="width:360px;padding:0;">
                  <div style="font-family:'nexa',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#1b2430;">
                    <div style="color:#66257c;margin-bottom:4px;">
                      <strong>Dirección</strong>
                    </div>
                    <div>Alte Brown nro. 3064 e/ 56 y 58 Punta Lara</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Logo -->
        <tr>
          <td align="left" style="padding:10px 0 18px 0;background:#ffffff;">
            <img src="${safeLogoUrl}" alt="Sista" width="120" style="display:block;width:120px;max-width:120px;height:auto;border:0;outline:none;text-decoration:none;" />
          </td>
        </tr>
      </table>

      <style>
        @media only screen and (max-width: 620px) {
          table[role="presentation"][width="600"] { width:100% !important; }
        }
      </style>
    </td>
  </tr>
</table>`;
	}

	$: bannerHtml = buildBannerHtml({ nombre, puesto, telIconUrl, whatsappIconUrl });

	function copyViaSelection(html) {
		const host = document.createElement('div');
		host.style.position = 'fixed';
		host.style.left = '-9999px';
		host.style.top = '0';
		host.style.width = '1px';
		host.style.height = '1px';
		host.style.overflow = 'hidden';
		host.innerHTML = html;
		document.body.appendChild(host);

		const selection = window.getSelection();
		if (!selection) return false;
		selection.removeAllRanges();
		const range = document.createRange();
		range.selectNodeContents(host);
		selection.addRange(range);

		const ok = document.execCommand('copy');
		selection.removeAllRanges();
		document.body.removeChild(host);
		return ok;
	}

	async function copyBannerRich() {
		if (typeof window === 'undefined') return;

		// 1) Método más compatible para "pegar tal cual" (incluye <img src="...">)
		const ok = copyViaSelection(bannerHtml);
		if (ok) return;

		// 2) Fallback a Clipboard API
		if (navigator?.clipboard) {
			try {
				const item = new ClipboardItem({
					'text/html': new Blob([bannerHtml], { type: 'text/html' }),
					'text/plain': new Blob([bannerHtml], { type: 'text/plain' })
				});
				await navigator.clipboard.write([item]);
				return;
			} catch {
				// ignore
			}
			try {
				await navigator.clipboard.writeText(bannerHtml);
			} catch {
				// ignore
			}
		}
	}
</script>

<main class="page">
	<section class="wrap">
		<header class="header">
			<h2 class="title">Banner para mail</h2>
			<p class="subtitle">Previsualización (podés copiar y pegar el contenido renderizado).</p>
		</header>

		<div class="card">
			<div class="form">
				<label class="field">
					<span class="label">Nombre</span>
					<input class="input" type="text" bind:value={nombre} placeholder="NOMBRE APELLIDO" />
				</label>
				<label class="field">
					<span class="label">Puesto</span>
					<input class="input" type="text" bind:value={puesto} placeholder="Puesto / Área" />
				</label>
			</div>
		</div>

		<div class="card">
			<div class="cardHead">
				<h3 class="cardTitle">Preview</h3>
				<button type="button" class="btn-secondary btn-sm" on:click={copyBannerRich}>Copiar banner</button>
			</div>
			<div class="preview">
				{@html bannerHtml}
			</div>
		</div>
	</section>
</main>

<style>
	.page {
		min-height: 100vh;
		background: #fff;
		font-family: 'nexa', sans-serif;
	}
	.wrap {
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem 1rem 3rem;
	}
	.header {
		margin-bottom: 1.25rem;
	}
	.title {
		margin: 0 0 0.25rem 0;
		text-align: left;
		color: var(--violeta1);
		font-size: 2rem;
	}
	.subtitle {
		margin: 0;
		color: var(--violeta1);
		opacity: 0.85;
	}
	.card {
		background: #fff;
		border: 1px solid rgba(102, 37, 124, 0.15);
		border-radius: 14px;
		box-shadow: 0 10px 30px rgba(102, 37, 124, 0.06);
		padding: 1rem;
		margin-top: 1rem;
	}
	.cardHead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}
	.cardTitle {
		margin: 0;
		color: var(--violeta1);
		font-size: 1.1rem;
		text-transform: none;
	}
	.preview {
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.06);
	}
	.form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.9rem;
	}
	.field {
		display: grid;
		gap: 0.35rem;
	}
	.label {
		color: var(--violeta1);
		font-weight: 600;
	}
	.input {
		width: 100%;
		border-radius: 12px;
		border: 1px solid rgba(102, 37, 124, 0.2);
		padding: 0.75rem 0.85rem;
		font-family: 'nexa', sans-serif;
		font-size: 1rem;
		color: var(--violeta1);
		background: #fff;
	}
	@media (max-width: 700px) {
		.form {
			grid-template-columns: 1fr;
		}
	}
</style>

