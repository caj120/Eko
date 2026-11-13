import { defineStore } from "pinia";
import { ref } from "vue";
import { FeedEcho, EchoType, EchoTypeName } from "@/types/types";

export const useCreateEchoDialogStore = defineStore("createEchoDialog", () => {
  const defaultCallback = () => {
    console.log("completed createEcho callback");
  };

  const createEchoDialogType = ref<EchoType>(EchoTypeName.Original);
  const createEchoDialogProps = ref<{
    originalEcho?: FeedEcho;
  }>();
  const createEchoCompleteCallback = ref<() => void>(defaultCallback);
  const showCreateEchoDialog = ref(false);

  const openCreateEchoDialog = (
    type: EchoType,
    original?: FeedEcho,
    callback?: () => void
  ) => {
    createEchoDialogType.value = type;
    createEchoDialogProps.value = {
      originalEcho: original,
    };
    createEchoCompleteCallback.value = callback || defaultCallback;

    showCreateEchoDialog.value = true;
  };

  const closeCreateEchoDialog = () => {
    showCreateEchoDialog.value = false;
  };

  return {
    createEchoDialogType,
    createEchoDialogProps,
    showCreateEchoDialog,
    createEchoCompleteCallback,
    openCreateEchoDialog,
    closeCreateEchoDialog,
  };
});
