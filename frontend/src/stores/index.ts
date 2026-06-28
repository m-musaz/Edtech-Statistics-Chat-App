// ============================================================================
// Store Export Hub
// ============================================================================

// Main store - all hooks and types exported from chatStore (control - admin_settings_id = 1)
export {
  useChatStore,
  useSession,
  useThreads,
  useMessages,
  type Message,
  type Chat
} from './chatStore';

// Plan store - all hooks and types for plan chat (admin_settings_id = 2)
export {
  usePlanChatStore,
  usePlanSession,
  usePlanThreads,
  usePlanMessages,
} from './planChatStore';

// Session management removed - using simple Zustand session state

// ============================================================================
// Migration Complete - Context Bridge Removed in Phase 4
// ============================================================================

// ============================================================================
// Store Initialization
// ============================================================================

/**
 * Initialize the store with default values
 * Call this in your App.tsx or main.tsx
 */
export const initializeStore = () => {
  console.log('Initializing Zustand chat store');
  
  // Any other initialization logic can go here
  
  console.log('Store initialized successfully');
};
