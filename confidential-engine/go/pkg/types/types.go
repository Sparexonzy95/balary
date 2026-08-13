// Package types contains the extension's public HTTP state types.
package types

import "github.com/ethereum/go-ethereum/common"

// State intentionally exposes operational counters only. Private payroll and
// withdrawal data never crosses the extension's state endpoint.
type State struct {
	Service           string `json:"service"`
	PayrollActions    uint64 `json:"payrollActions"`
	WithdrawalActions uint64 `json:"withdrawalActions"`
}

type StateResponse struct {
	StateVersion common.Hash `json:"stateVersion"`
	State        State       `json:"state"`
}
