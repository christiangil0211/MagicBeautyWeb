import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Identidad visual de Magic Beauty: superficies blancas, ambiente rosa muy pálido,
 * fucsia como acento y vino oscuro en los títulos. Se construye sobre Aura para
 * heredar el comportamiento de los componentes y mantenerlos integrados.
 */
export const MagicBeautyPreset = definePreset(Aura, {
  primitive: {
    raspberry: {
      50: '#fff8fb',
      100: '#fdeff5',
      200: '#fbe2ec',
      300: '#f7d0e0',
      400: '#f2579e',
      500: '#e6398b',
      600: '#d5317f',
      700: '#c92d76',
      800: '#a0245e',
      900: '#771b46',
      950: '#5e1533'
    },
    roseGold: {
      50: '#fdf6f3',
      100: '#fbeae4',
      200: '#f6d5c9',
      300: '#edb7a3',
      400: '#e19677',
      500: '#d4a088',
      600: '#c08265',
      700: '#a06850',
      800: '#805646',
      900: '#69483c',
      950: '#38241d'
    }
  },
  semantic: {
    primary: {
      50: '{raspberry.50}',
      100: '{raspberry.100}',
      200: '{raspberry.200}',
      300: '{raspberry.300}',
      400: '{raspberry.400}',
      500: '{raspberry.500}',
      600: '{raspberry.600}',
      700: '{raspberry.700}',
      800: '{raspberry.800}',
      900: '{raspberry.900}',
      950: '{raspberry.950}'
    },
    borderRadius: {
      none: '0',
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '24px'
    },
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{primary.400}',
      offset: '2px'
    },
    colorScheme: {
      light: {
        primary: {
          color: '{raspberry.500}',
          contrastColor: '#ffffff',
          hoverColor: '{raspberry.700}',
          activeColor: '{raspberry.800}'
        },
        highlight: {
          background: '{raspberry.50}',
          focusBackground: '{raspberry.100}',
          color: '{raspberry.800}',
          focusColor: '{raspberry.900}'
        },
        surface: {
          0: '#ffffff',
          50: '#fff8fb',
          100: '#fbe2ec',
          200: '#f7d0e0',
          300: '#e9bfcf',
          400: '#cda8b7',
          500: '#a18e99',
          600: '#7b6470',
          700: '#5c4753',
          800: '#3f2b36',
          900: '#2a1a23',
          950: '#160c12'
        },
        content: {
          background: '#ffffff',
          hoverBackground: '{raspberry.50}',
          borderColor: '{surface.200}',
          color: '{surface.800}'
        },
        text: {
          color: '{surface.800}',
          hoverColor: '{surface.950}',
          mutedColor: '{surface.600}',
          hoverMutedColor: '{surface.700}'
        }
      }
    }
  },
  components: {
    button: {
      root: {
        borderRadius: '999px',
        paddingX: '1.35rem',
        gap: '0.5rem',
        label: { fontWeight: '600' }
      }
    },
    tree: {
      root: { background: 'transparent' },
      node: {
        borderRadius: '10px',
        padding: '0.55rem 0.7rem',
        selectedColor: '{raspberry.700}',
        selectedBackground: '{raspberry.100}'
      }
    },
    card: {
      root: { borderRadius: '16px' }
    },
    inputtext: {
      root: { borderRadius: '10px', background: '#ffffff' }
    },
    select: {
      root: { borderRadius: '10px', background: '#ffffff' }
    },
    multiselect: {
      root: { borderRadius: '10px', background: '#ffffff' },
      chip: { borderRadius: '999px' }
    },
    textarea: {
      root: { borderRadius: '10px', background: '#ffffff' }
    },
    datatable: {
      headerCell: { background: '#ffffff', color: '{surface.600}' },
      row: { background: '#ffffff' }
    },
    dialog: {
      root: { borderRadius: '18px' }
    },
    tag: {
      root: { borderRadius: '999px', fontWeight: '600' }
    },
    toast: {
      root: { borderRadius: '14px' }
    }
  }
});
