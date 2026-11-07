import type { Explanation, Picture } from "@shared/schemas/nasa";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

/* Talking to /api/nasa from the browser. Same shape as features/events. */

export const nasaKeys = {
  pictures: ["nasa", "pictures"] as const,
};

/**
 * 20 random pictures. They are random, so they never go "stale" by
 * themselves - call `refetch()` for a new set.
 */
export function usePictures() {
  return useQuery({
    queryKey: nasaKeys.pictures,
    queryFn: () => api<{ pictures: Picture[] }>("/api/nasa/pictures?count=20"),
    select: (data) => data.pictures,
    staleTime: Infinity,
    // A NASA failure already comes back as a clear error from our server;
    // retrying it straight away would only make the user wait longer.
    retry: false,
  });
}

/** Asks the server to explain one picture in Hebrew. */
export function useExplainPicture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      api<Explanation>("/api/nasa/explanations", {
        method: "POST",
        body: { date },
      }),
    onSuccess: ({ date, ...hebrew }) => {
      // We already have the answer, so write it into the pictures we have,
      // instead of fetching 20 new random ones.
      queryClient.setQueryData<{ pictures: Picture[] }>(
        nasaKeys.pictures,
        (old) =>
          old && {
            pictures: old.pictures.map((picture) =>
              picture.date === date ? { ...picture, hebrew } : picture,
            ),
          },
      );
    },
  });
}
