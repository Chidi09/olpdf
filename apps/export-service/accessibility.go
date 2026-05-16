package main

import (
	"bytes"
	"fmt"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

func InjectPDFUA(buf *bytes.Buffer) (*bytes.Buffer, error) {
	conf := model.NewDefaultConfiguration()
	ctx, err := api.ReadContext(buf, conf)
	if err != nil {
		return nil, fmt.Errorf("read pdf context: %w", err)
	}

	ctx.Doc.RootDict.Insert(types.Name("MarkInfo"), types.Dict{
		types.Name("Marked"): types.Boolean(true),
	})
	ctx.Doc.RootDict.Insert(types.Name("Lang"), types.StringLiteral("en-US"))

	var out bytes.Buffer
	if err := api.WriteContext(&out, ctx); err != nil {
		return nil, fmt.Errorf("write pdf: %w", err)
	}
	return &out, nil
}
