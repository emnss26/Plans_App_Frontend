import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export default function SelectModelsModal({ models = [], open, onClose, onSave }) {
  const [selected, setSelected] = useState([]);

  const handleToggle = (modelId) => {
    setSelected((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  const handleSave = () => {
    onSave(selected);
    setSelected([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select the models to analyze</DialogTitle>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto py-4">
          {Array.isArray(models) && models.length > 0 ? (
            models.map((model) => (
              <label
                key={model.id}
                className="flex cursor-pointer items-center gap-3 rounded px-2 py-1 hover:bg-accent"
              >
                <Checkbox
                  id={model.id}
                  checked={selected.includes(model.id)}
                  onCheckedChange={() => handleToggle(model.id)}
                  className="mr-2"
                />
                <span className="font-medium">{model.name}</span>
              </label>
            ))
          ) : (
            <span className="text-gray-500">No models available to select.</span>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-[rgb(170,32,47)] text-white"
            disabled={selected.length === 0}
            onClick={handleSave}
          >
            Save selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
