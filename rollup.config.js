import buble from 'rollup-plugin-buble';
import filesize from 'rollup-plugin-filesize';

export default {
	entry: 'src/index.js',
	dest: 'build/instantclick.js',
	format: 'umd',
	moduleName: 'InstantClick',
	plugins: [
		buble({
			transforms: {
				dangerousForOf: true
			}
		}),
		filesize()
	]
};
