import { arrayAdapter } from './arrayadapter.mjs';
import { USIZE_MAX, choose_medoid_within_partition } from './util.mjs';
import { initial_assignment, find_best_swap, do_swap, update_removal_loss } from './fasterpam.mjs';

/**
 * Run the FastPAM1 algorithm, which yields the same results as the original PAM.
 *
 * This is faster than PAM, but slower than FasterPAM, and mostly of interest for academic reasons.
 * Quality-wise, FasterPAM is not worse on average, but much faster.
 *
 * This is the improved version from the journal version of the paper,
 * which costs O(n²) per iteration to find the best swap.
 *
 * @param {object} mat - a pairwise distance matrix (array or wrapped)
 * @param {number[]} med - the list of medoids (mutated in place)
 * @param {number} maxiter - the maximum number of iterations allowed
 * @returns {{ loss: number, assi: number[], nIter: number, nSwaps: number }}
 */
export function fastpam1(mat, med, maxiter) {
	mat = arrayAdapter(mat);
	const n = mat.len();
	const k = med.length;
	if (k === 1) {
		const assi = new Array(n).fill(0);
		const [swapped, loss] = choose_medoid_within_partition(mat, assi, med, 0);
		return { loss, assi, nIter: 1, nSwaps: swapped ? 1 : 0 };
	}
	let [loss, data] = initial_assignment(mat, med);
	const removal_loss = new Array(k).fill(0);
	let n_swaps = 0;
	let iter = 0;
	while (iter < maxiter) {
		iter += 1;
		let best = [0, USIZE_MAX, USIZE_MAX];
		update_removal_loss(data, removal_loss);
		for (let j = 0; j < n; j++) {
			if (j === med[data[j].near.i]) {
				continue; // This already is a medoid
			}
			const [change, b] = find_best_swap(mat, removal_loss, data, j);
			if (change >= best[0]) {
				continue; // No improvement
			}
			best = [change, b, j];
		}
		if (best[0] < 0) {
			n_swaps += 1;
			// perform the swap
			const newloss = do_swap(mat, med, data, best[1], best[2]);
			if (newloss >= loss) {
				break; // Probably numerically unstable now.
			}
			loss = newloss;
		} else {
			break; // No improvement, or NaN.
		}
	}
	const assi = data.map(x => x.near.i);
	return { loss, assi, nIter: iter, nSwaps: n_swaps };
}
