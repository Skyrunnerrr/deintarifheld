/**
 * Bridge @supabase/ssr session client → M11N gateHostedA11Request injectables.
 */
export function createHostedAuthAdapters(supabase) {
  return {
    async getUser(accessToken) {
      if (accessToken) {
        return supabase.auth.getUser(accessToken);
      }
      return supabase.auth.getUser();
    },
    async getAuthenticatorAssuranceLevel() {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) {
        return { currentLevel: null, nextLevel: null, error };
      }
      return {
        currentLevel: data?.currentLevel ?? null,
        nextLevel: data?.nextLevel ?? null,
        error: null,
      };
    },
    async getAccessToken() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error || !session?.access_token) return null;
      return session.access_token;
    },
  };
}
