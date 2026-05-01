import { trpc } from '../../lib/trpc'


export const DashboardPage = () => {
 
    const { data, error, isLoading, isFetching, isError } = trpc.getData.useQuery()

    if (isLoading || isFetching) {
        return <span>Loading...</span>
    }

    if (isError) {
        return <span>Error: {error.message}</span>

    }

  return (
    <div>
      <h1>Dashboard</h1>
      {data.data.map((component) => {
        return (
          <div key={component.id}>
            <h2>{component.name}</h2>
            <p>{component.description}</p>
          </div>
        );
      })}
    </div>
  );
};