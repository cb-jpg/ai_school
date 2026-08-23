/**
 * Knowledge base component styles
 */
import { css } from '@emotion/react';

const isElectron = window.api !== undefined;

export const knowledgeStyles = {
  // Drawer styles
  drawer: {
    content: {
      background: 'var(--chakra-colors-gray-900)',
      maxWidth: '600px',
      marginTop: isElectron ? '30px' : '0',
      height: isElectron ? 'calc(100vh - 30px)' : '100vh'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      position: 'relative',
      px: 6,
      py: 4
    },
    title: {
      color: 'white',
      fontSize: 'lg',
      fontWeight: 'semibold'
    },
    closeButton: {
      position: 'absolute',
      right: 1,
      top: 1,
      color: 'white'
    }
  },

  // Tab styles
  tabs: {
    root: {
      width: '100%',
      variant: 'line' as const,
      colorPalette: 'gray'
    },
    list: {
      display: 'flex',
      borderBottom: '1px solid',
      borderColor: 'whiteAlpha.200',
      mb: 4,
      px: 4
    },
    trigger: {
      color: 'whiteAlpha.600',
      _selected: {
        color: 'white',
        borderBottomColor: 'blue.500'
      },
      _hover: {
        color: 'white'
      }
    },
    content: {
      px: 4,
      pb: 4
    }
  },

  // Toolbar styles
  toolbar: {
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      mb: 4,
      flexWrap: 'wrap' as const
    },
    search: {
      flex: 1,
      minW: '200px'
    },
    filters: {
      display: 'flex',
      gap: 2,
      alignItems: 'center'
    },
    actions: {
      display: 'flex',
      gap: 2,
      ml: 'auto'
    }
  },

  // List styles
  list: {
    container: {
      flex: 1,
      overflowY: 'auto',
      css: css`
        &::-webkit-scrollbar {
          width: 4px;
        }
        &::-webkit-scrollbar-track {
          background: var(--chakra-colors-whiteAlpha-100);
          border-radius: full;
        }
        &::-webkit-scrollbar-thumb {
          background: var(--chakra-colors-whiteAlpha-300);
          border-radius: full;
        }
      `
    },
    empty: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      py: 12,
      color: 'whiteAlpha.500'
    }
  },

  // Card styles
  card: {
    container: {
      mb: 3,
      p: 4,
      borderRadius: 'md',
      bg: 'whiteAlpha.50',
      border: '1px solid',
      borderColor: 'whiteAlpha.100',
      cursor: 'pointer',
      transition: 'all 0.2s',
      _hover: {
        bg: 'whiteAlpha.100',
        borderColor: 'whiteAlpha.200'
      }
    },
    selected: {
      bg: 'whiteAlpha.200',
      borderColor: 'blue.500',
      borderLeftWidth: '4px',
      borderLeftStyle: 'solid'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      mb: 2
    },
    title: {
      fontSize: 'md',
      fontWeight: 'semibold',
      color: 'white',
      flex: 1
    },
    checkbox: {
      mt: 1
    },
    meta: {
      display: 'flex',
      gap: 3,
      alignItems: 'center',
      mb: 2
    },
    tag: {
      fontSize: 'xs',
      px: 2,
      py: 1,
      borderRadius: 'md',
      bg: 'whiteAlpha.100',
      color: 'whiteAlpha.700'
    },
    status: {
      fontSize: 'xs',
      px: 2,
      py: 1,
      borderRadius: 'md'
    },
    summary: {
      fontSize: 'sm',
      color: 'whiteAlpha.600',
      noOfLines: 2,
      mb: 2
    },
    footer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      pt: 2,
      borderTop: '1px solid',
      borderColor: 'whiteAlpha.100'
    },
    actions: {
      display: 'flex',
      gap: 1
    }
  },

  // Upload styles
  upload: {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4
    },
    dropZone: {
      border: '2px dashed',
      borderColor: 'whiteAlpha.300',
      borderRadius: 'lg',
      p: 8,
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
      _hover: {
        borderColor: 'blue.500',
        bg: 'whiteAlpha.50'
      }
    },
    dropZoneActive: {
      borderColor: 'blue.500',
      bg: 'blue.500',
      color: 'white'
    },
    progress: {
      my: 4
    }
  },

  // Form styles
  form: {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4
    },
    field: {
      label: {
        fontSize: 'sm',
        color: 'whiteAlpha.700',
        mb: 2
      },
      input: {
        bg: 'whiteAlpha.100',
        borderColor: 'whiteAlpha.200',
        color: 'white',
        _placeholder: {
          color: 'whiteAlpha.400'
        },
        _hover: {
          bg: 'whiteAlpha.200'
        }
      },
      textarea: {
        bg: 'whiteAlpha.100',
        borderColor: 'whiteAlpha.200',
        color: 'white',
        minHeight: '120px',
        resize: 'vertical' as const
      }
    }
  },

  // Statistics styles
  stats: {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4
    },
    cards: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 4
    },
    card: {
      p: 4,
      borderRadius: 'lg',
      bg: 'whiteAlpha.50',
      border: '1px solid',
      borderColor: 'whiteAlpha.100'
    },
    statValue: {
      fontSize: '2xl',
      fontWeight: 'bold',
      color: 'white'
    },
    statLabel: {
      fontSize: 'sm',
      color: 'whiteAlpha.600',
      mt: 1
    },
    section: {
      p: 4,
      borderRadius: 'lg',
      bg: 'whiteAlpha.50',
      border: '1px solid',
      borderColor: 'whiteAlpha.100'
    },
    sectionTitle: {
      fontSize: 'md',
      fontWeight: 'semibold',
      color: 'white',
      mb: 3
    },
    questionList: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 2
    },
    questionItem: {
      p: 3,
      borderRadius: 'md',
      bg: 'whiteAlpha.100',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }
} as const;
