import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useInstalledPlugins(workspaceId: string) {
  return useQuery({
    queryKey: ['installed-plugins', workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/bff/workspaces/${workspaceId}/plugins`);
      if (!res.ok) throw new Error('Failed to fetch installed plugins');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

export function useInstallPlugin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ workspaceId, pluginId }: { workspaceId: string; pluginId: string }) => {
      const res = await fetch(`/api/bff/workspaces/${workspaceId}/plugins/${pluginId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to install plugin');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['installed-plugins', variables.workspaceId] });
    },
  });
}
