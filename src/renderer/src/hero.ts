import { heroui } from '@heroui/react'

export default heroui({
  themes: {
    light: {
      colors: {
        default: {
          50: '#f8f9fa',
          100: '#f1f3f4',
          200: '#e8eaed',
          300: '#dadce0',
          400: '#bdc1c6',
          500: '#9aa0a6',
          600: '#80868b',
          700: '#5f6368',
          800: '#3c4043',
          900: '#202124',
          foreground: '#5f6368', // 改为较浅的颜色，避免焦点时的粗黑边框
          DEFAULT: '#f1f3f4'
        }
      },
      layout: {
        borderWidth: {
          small: '1px',
          medium: '1px', // 将medium边框改为1px
          large: '2px'
        }
      }
    },
    dark: {
      colors: {
        default: {
          50: '#18181b',
          100: '#27272a',
          200: '#3f3f46',
          300: '#52525b',
          400: '#71717a',
          500: '#a1a1aa',
          600: '#d4d4d8',
          700: '#e4e4e7',
          800: '#f4f4f5',
          900: '#fafafa',
          foreground: '#d4d4d8', // 改为较浅的颜色
          DEFAULT: '#27272a'
        }
      },
      layout: {
        borderWidth: {
          small: '1px',
          medium: '1px', // 将medium边框改为1px
          large: '2px'
        }
      }
    }
  }
})
