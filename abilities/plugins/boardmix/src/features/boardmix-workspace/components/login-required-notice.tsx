export interface LoginRequiredNoticeProps {
	title: string;
	body: string;
}

/**
 * 登录态是 boardmix 自己的事：这里只说明「为什么看到的是登录页」，
 * 不代填、不代持凭据，也不假装用户已经登录。
 */
export function LoginRequiredNotice(props: LoginRequiredNoticeProps) {
	return (
		<div className="flex flex-col gap-1 border-b border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm">
			<p className="font-medium text-foreground">{props.title}</p>
			<p className="text-muted-foreground">{props.body}</p>
		</div>
	);
}
