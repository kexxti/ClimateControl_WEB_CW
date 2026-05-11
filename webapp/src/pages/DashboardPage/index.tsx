import { getRoom } from '../../lib/routes';
import { trpc } from '../../lib/trpc'
import { Link } from 'react-router-dom';


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
          <div key={component.name}>
            <h2><Link to={getRoom({ roomID: component.roomID })}>
                  {component.name}
                </Link></h2>
            <p>{component.temperature}</p>
          </div>
        );
      })}
    </div>
  );
};