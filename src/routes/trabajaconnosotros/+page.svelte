<script>
import { onDestroy, onMount } from "svelte";
import { MetaTags } from "svelte-meta-tags";
import FormHandler from "./_components/FormHandler.svelte";
import AlertCustom from "./_components/AlertCustom.svelte";
import { step } from './_components/states';

const recaptchaSiteKeyBaja = import.meta.env.VITE_RECAPTCHA_SITE_KEY_BAJA ?? '6LdBk_YmAAAAAJAM7B2-HXaobQq3lyQt6u5hNDGa';
</script>

<svelte:head>
    <script type="text/javascript">
        var onloadCallback = function() {
          grecaptcha.render('html_element', {
            'sitekey' : '{recaptchaSiteKeyBaja}'
          });
        };
      </script>
</svelte:head>

<MetaTags
    title= 'Sista - Trabaja con Nosotros'
    description= 'Llená el formulario y aplicá para alguna de nuestras vacantes de trabajo'
></MetaTags>


<AlertCustom></AlertCustom>
<section>
    <div>
        <div class="form-container">
            <FormHandler></FormHandler>
        </div>
    </div>
</section>


<style lang="scss">
@import './styles.scss';

</style>

