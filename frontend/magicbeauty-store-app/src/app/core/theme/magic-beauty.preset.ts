import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Identidad visual tomada de MagicCuadre: superficies blancas, grises fríos
 * neutros, fucsia #EC1C79 como único acento, radios de 7px en controles y 12px
 * en tarjetas. Se construye sobre Aura para heredar el comportamiento de los
 * componentes. Debe mantenerse alineado con los tokens de styles.scss.
 */
export const MagicBeautyPreset = definePreset(Aura, {
  primitive: {
    fuchsia: {
      50: '#fffafc',
      100: '#fff0f6',
      200: '#fce4ef',
      300: '#f3b6d0',
      400: '#f0559c',
      500: '#ec1c79',
      600: '#cf1467',
      700: '#b0105a',
      800: '#8a3e5d',
      900: '#6b1d3d',
      950: '#35202b'
    },
    neutral: {
      50: '#fafafb',
      100: '#f5f6f8',
      200: '#ececf1',
      300: '#e1e1e7',
      400: '#b5b5bd',
      500: '#71717a',
      600: '#52525b',
      700: '#3f3f46',
      800: '#2d2430',
      900: '#171717',
      950: '#0a0a0a'
    }
  },
  semantic: {
    primary: {
      50: '{fuchsia.50}',
      100: '{fuchsia.100}',
      200: '{fuchsia.200}',
      300: '{fuchsia.300}',
      400: '{fuchsia.400}',
      500: '{fuchsia.500}',
      600: '{fuchsia.600}',
      700: '{fuchsia.700}',
      800: '{fuchsia.800}',
      900: '{fuchsia.900}',
      950: '{fuchsia.950}'
    },
    borderRadius: {
      none: '0',
      xs: '4px',
      sm: '5px',
      md: '7px',
      lg: '12px',
      xl: '16px'
    },
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{primary.400}',
      offset: '2px'
    },
    formField: {
      paddingX: '0.75rem',
      paddingY: '0.5rem',
      borderRadius: '7px'
    },
    colorScheme: {
      light: {
        primary: {
          color: '{fuchsia.500}',
          contrastColor: '#ffffff',
          hoverColor: '{fuchsia.600}',
          activeColor: '{fuchsia.700}'
        },
        highlight: {
          background: '{fuchsia.100}',
          focusBackground: '{fuchsia.200}',
          color: '{fuchsia.500}',
          focusColor: '{fuchsia.600}'
        },
        surface: {
          0: '#ffffff',
          50: '{neutral.50}',
          100: '{neutral.100}',
          200: '{neutral.200}',
          300: '{neutral.300}',
          400: '{neutral.400}',
          500: '{neutral.500}',
          600: '{neutral.600}',
          700: '{neutral.700}',
          800: '{neutral.800}',
          900: '{neutral.900}',
          950: '{neutral.950}'
        },
        formField: {
          background: '#ffffff',
          borderColor: '{neutral.300}',
          hoverBorderColor: '{fuchsia.500}',
          focusBorderColor: '{fuchsia.500}',
          color: '{neutral.800}',
          placeholderColor: '{neutral.500}'
        },
        content: {
          background: '#ffffff',
          hoverBackground: '{fuchsia.50}',
          borderColor: '{neutral.200}',
          color: '{neutral.800}'
        },
        text: {
          color: '{neutral.800}',
          hoverColor: '{neutral.900}',
          mutedColor: '{neutral.500}',
          hoverMutedColor: '{neutral.600}'
        }
      }
    }
  },
  components: {
    button: {
      root: {
        borderRadius: '7px',
        paddingX: '1.2rem',
        paddingY: '0.6rem',
        gap: '0.5rem',
        label: { fontWeight: '600' }
      }
    },
    tree: {
      root: { background: 'transparent' },
      node: {
        borderRadius: '7px',
        padding: '0.55rem 0.7rem',
        selectedColor: '{fuchsia.500}',
        selectedBackground: '{fuchsia.100}'
      }
    },
    card: {
      root: { borderRadius: '12px' }
    },
    inputtext: {
      root: { borderRadius: '7px', background: '#ffffff' }
    },
    select: {
      root: { borderRadius: '7px', background: '#ffffff' },
      option: {
        selectedBackground: '{fuchsia.100}',
        selectedColor: '{fuchsia.500}',
        focusBackground: '{fuchsia.50}'
      }
    },
    multiselect: {
      root: { borderRadius: '7px', background: '#ffffff' },
      chip: { borderRadius: '999px' }
    },
    textarea: {
      root: { borderRadius: '7px', background: '#ffffff' }
    },
    datatable: {
      headerCell: {
        background: '{fuchsia.50}',
        color: '{fuchsia.800}',
        borderColor: '#f3dce6'
      },
      bodyCell: { borderColor: '#f3dce6' },
      row: {
        background: '#ffffff',
        hoverBackground: '{fuchsia.50}',
        selectedBackground: '{fuchsia.100}',
        color: '{neutral.800}'
      }
    },
    dialog: {
      root: { borderRadius: '12px' }
    },
    tag: {
      root: { borderRadius: '999px', fontWeight: '600' }
    },
    toast: {
      root: { borderRadius: '10px' }
    },
    toggleswitch: {
      root: { checkedBackground: '{fuchsia.500}', checkedHoverBackground: '{fuchsia.600}' }
    }
  }
});
