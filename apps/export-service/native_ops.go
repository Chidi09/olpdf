package main

// EditOperation represents a single user edit that should be applied
// to the original document blocks before export.
type EditOperation struct {
	ID             string                 `json:"id"`
	Type           string                 `json:"type"`
	PageIndex      int                    `json:"pageIndex"`
	TargetObjectID string                 `json:"targetObjectId"`
	Before         map[string]interface{} `json:"before"`
	After          map[string]interface{} `json:"after"`
	CreatedAt      string                 `json:"createdAt"`
}

// applyOperations mutates the document model blocks to reflect
// the recorded edit operations. This is applied before PDF generation
// so the export output includes all user edits.
func applyOperations(model *DocumentModel, ops []EditOperation) {
	if len(ops) == 0 {
		return
	}

	blockIndex := make(map[string]*Block, len(model.Blocks))
	for i := range model.Blocks {
		blockIndex[model.Blocks[i].ID] = &model.Blocks[i]
	}

	for _, op := range ops {
		block, ok := blockIndex[op.TargetObjectID]
		if !ok {
			continue
		}

		switch op.Type {
		case "replace_text":
			if after, ok := op.After["text"]; ok {
				if text, ok := after.(string); ok {
					block.Content = text
				}
			}
			if after, ok := op.After["bbox"]; ok {
				if bbox, ok := toFloatSlice(after); ok && len(bbox) == 4 {
					block.BoundingBox = bbox
				}
			}

		case "move_object", "resize_object":
			if after, ok := op.After["bbox"]; ok {
				if bbox, ok := toFloatSlice(after); ok && len(bbox) == 4 {
					block.BoundingBox = bbox
				}
			}

		case "delete_object":
			block.Content = ""
			block.BoundingBox = []float64{0, 0, 0, 0}

		case "insert_text":
			if after, ok := op.After["text"]; ok {
				if text, ok := after.(string); ok {
					block.Content = text
				}
			}
			if after, ok := op.After["bbox"]; ok {
				if bbox, ok := toFloatSlice(after); ok && len(bbox) == 4 {
					block.BoundingBox = bbox
				}
			}
			if block.ID == "" {
				block.ID = op.TargetObjectID
			}

		case "insert_shape":
			if after, ok := op.After["bbox"]; ok {
				if bbox, ok := toFloatSlice(after); ok && len(bbox) == 4 {
					block.BoundingBox = bbox
				}
			}
			if block.ID == "" {
				block.ID = op.TargetObjectID
			}
		}
	}
}

func toFloatSlice(val interface{}) ([]float64, bool) {
	raw, ok := val.([]interface{})
	if !ok {
		return nil, false
	}
	result := make([]float64, len(raw))
	for i, v := range raw {
		switch n := v.(type) {
		case float64:
			result[i] = n
		case int:
			result[i] = float64(n)
		default:
			return nil, false
		}
	}
	return result, true
}
